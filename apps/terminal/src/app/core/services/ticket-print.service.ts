import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { TicketService } from './ticket.service';

interface TicketDocumentView {
  ticketId?: string;
  reference?: string;
  htmlContent?: string;
  printHtmlContent?: string;
  emailHtmlContent?: string;
  subject?: string;
}

@Injectable({ providedIn: 'root' })
export class TicketPrintService {
  constructor(
    private ticketService: TicketService,
    @Inject(DOCUMENT) private document: Document,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {}

  async printTicket(ticketId: string): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      throw new Error('PRINT_NOT_AVAILABLE');
    }

    const printWindow = this.openPrintWindow();
    try {
      const documentView = await firstValueFrom(
        this.ticketService.getTicketDocument(ticketId),
      );
      await this.printDocument(printWindow, documentView, true);
    } catch (error) {
      this.safeCloseWindow(printWindow);
      throw error;
    }
  }

  async printOrder(orderId: string, ticketIds: string[]): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      throw new Error('PRINT_NOT_AVAILABLE');
    }

    const uniqueTicketIds = Array.from(
      new Set(
        (ticketIds ?? []).map((ticketId) => ticketId?.trim()).filter(Boolean),
      ),
    );
    if (!orderId?.trim() || !uniqueTicketIds.length) {
      throw new Error('PRINT_CONTENT_MISSING');
    }

    const printWindow = this.openPrintWindow();

    try {
      for (const ticketId of uniqueTicketIds) {
        const documentView = await firstValueFrom(
          this.ticketService.getTicketDocument(ticketId),
        );
        await this.printDocument(printWindow, documentView, true, true);
      }
    } catch (error) {
      this.safeCloseWindow(printWindow);
      throw error;
    }

    this.safeCloseWindow(printWindow);
  }

  private async printDocument(
    printWindow: Window,
    documentView: TicketDocumentView | null,
    singlePage: boolean,
    waitForPrintDialog = false,
  ): Promise<void> {
    const htmlContent =
      documentView?.printHtmlContent?.trim() ??
      documentView?.htmlContent?.trim();
    if (!htmlContent) {
      throw new Error('PRINT_CONTENT_MISSING');
    }

    const printableHtml = this.buildPrintableHtml(htmlContent);
    printWindow.document.open();
    printWindow.document.write(printableHtml);
    printWindow.document.close();

    await this.waitForWindowReady(printWindow);
    await this.waitForImages(printWindow.document);

    if (waitForPrintDialog) {
      const imageUrls = await this.buildPrintImageUrls(
        printWindow.document,
        singlePage,
      );
      await this.presentPrintImages(printWindow, imageUrls);
      return;
    }

    const pdfUrl = await this.buildPdfUrl(printWindow.document, singlePage);
    await this.presentPdf(printWindow, pdfUrl);
  }

  private buildPrintableHtml(htmlContent: string): string {
    const printEnhancements = `
      <style>
        @page {
          size: auto;
          margin: 8mm;
        }

        html, body {
          background: #ffffff !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: visible !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        body.pdf-print {
          background: #ffffff !important;
        }

        body.pdf-print .document-shell {
          padding: 0 !important;
          width: 210mm !important;
          margin: 0 auto !important;
        }

        body.pdf-print .pdf-page {
          width: 210mm !important;
          height: 297mm !important;
          min-height: 297mm !important;
          margin: 0 auto !important;
          padding: 0 !important;
          display: flex !important;
          align-items: stretch !important;
          box-sizing: border-box !important;
          background: #ffffff !important;
        }

        body.pdf-print .ticket-sheet {
          max-width: none !important;
          margin: 0 auto !important;
          box-shadow: none !important;
          width: 100% !important;
          height: 100% !important;
          min-height: 100% !important;
          box-sizing: border-box !important;
          display: flex !important;
          flex-direction: column !important;
        }

        body.pdf-print .ticket-layout {
          flex: 1 1 auto !important;
        }

        body.pdf-print .ticket-footer {
          margin-top: auto !important;
        }

        body.pdf-print .ticket-hero {
          padding: 20px !important;
        }

        body.pdf-print .ticket-eyebrow,
        body.pdf-print .info-label,
        body.pdf-print .qr-badge,
        body.pdf-print .hero-tag,
        body.pdf-print .status-chip {
          font-size: 10px !important;
        }

        body.pdf-print .ticket-brand {
          font-size: 24px !important;
        }

        body.pdf-print .route-title {
          font-size: 30px !important;
        }

        body.pdf-print .route-copy,
        body.pdf-print .ticket-company-copy,
        body.pdf-print .info-copy,
        body.pdf-print .ticket-footer,
        body.pdf-print .qr-hint {
          font-size: 12px !important;
          line-height: 1.4 !important;
        }

        body.pdf-print .info-value,
        body.pdf-print .qr-reference {
          font-size: 17px !important;
        }

        .ticket-sheet,
        .ticket-layout,
        .qr-panel,
        .qr-frame {
          break-inside: avoid;
          page-break-inside: avoid;
        }

        .pdf-page {
          page-break-after: always;
          break-after: page;
        }

        .pdf-page:last-child {
          page-break-after: auto;
          break-after: auto;
        }

        body.pdf-print .qr-frame {
          padding: 14px !important;
        }

        body.pdf-print .qr-frame img {
          width: 150px !important;
          height: 150px !important;
        }
      </style>
    `;

    const blankTitle = '<title></title>';

    if (/<head[\s>]/i.test(htmlContent)) {
      let withHead = htmlContent;
      if (/<title[\s\S]*?<\/title>/i.test(withHead)) {
        withHead = withHead.replace(/<title[\s\S]*?<\/title>/i, blankTitle);
      } else {
        withHead = withHead.replace(/<head([^>]*)>/i, `<head$1>${blankTitle}`);
      }

      return withHead.replace(/<\/head>/i, `${printEnhancements}</head>`);
    }

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          ${blankTitle}
          ${printEnhancements}
        </head>
        <body>${htmlContent}</body>
      </html>
    `;
  }

  private openPrintWindow(): Window {
    const printWindow = this.document.defaultView?.open(
      'about:blank',
      '_blank',
      'popup,width=1100,height=1400',
    );

    if (!printWindow) {
      throw new Error('PRINT_WINDOW_UNAVAILABLE');
    }

    return printWindow;
  }

  private async buildPrintImageUrls(
    printDocument: Document,
    singlePage: boolean,
  ): Promise<string[]> {
    const { default: html2canvas } = await import('html2canvas');

    printDocument.body.classList.add('pdf-print');
    const sheetTargets = Array.from(
      printDocument.querySelectorAll('.ticket-sheet'),
    ).filter(
      (element): element is HTMLElement => element instanceof HTMLElement,
    );
    const pageTargets = Array.from(
      printDocument.querySelectorAll('.pdf-page'),
    ).filter(
      (element): element is HTMLElement => element instanceof HTMLElement,
    );
    const renderTarget =
      (printDocument.querySelector('.document-shell') as HTMLElement | null) ??
      printDocument.body;
    const renderTargets = sheetTargets.length
      ? sheetTargets
      : pageTargets.length
        ? pageTargets
        : [renderTarget];
    const imageUrls: string[] = [];

    for (const target of renderTargets) {
      const canvas = await html2canvas(target, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: Math.max(target.scrollWidth, target.clientWidth),
        windowHeight: Math.max(target.scrollHeight, target.clientHeight),
      });

      imageUrls.push(canvas.toDataURL('image/png', 1));
      if (singlePage) {
        break;
      }
    }

    return imageUrls;
  }

  private async buildPdfUrl(
    printDocument: Document,
    singlePage: boolean,
  ): Promise<string> {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);

    printDocument.body.classList.add('pdf-print');
    const pageTargets = Array.from(
      printDocument.querySelectorAll('.pdf-page'),
    ).filter(
      (element): element is HTMLElement => element instanceof HTMLElement,
    );
    const renderTarget =
      (printDocument.querySelector('.document-shell') as HTMLElement | null) ??
      printDocument.body;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = singlePage ? 6 : 8;
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;
    const renderTargets = pageTargets.length ? pageTargets : [renderTarget];

    for (let index = 0; index < renderTargets.length; index += 1) {
      const target = renderTargets[index];
      const canvas = await html2canvas(target, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: Math.max(target.scrollWidth, target.clientWidth),
        windowHeight: Math.max(target.scrollHeight, target.clientHeight),
      });

      if (index > 0) {
        pdf.addPage();
      }

      const imageData = canvas.toDataURL('image/png', 1);

      if (pageTargets.length) {
        pdf.addImage(
          imageData,
          'PNG',
          0,
          0,
          pageWidth,
          pageHeight,
          undefined,
          'FAST',
        );
        continue;
      }

      const scaledHeight = (canvas.height * usableWidth) / canvas.width;
      let renderWidth = usableWidth;
      let renderHeight = scaledHeight;

      if (renderHeight > usableHeight) {
        renderHeight = usableHeight;
        renderWidth = (canvas.width * renderHeight) / canvas.height;
      }

      const offsetX = (pageWidth - renderWidth) / 2;
      const offsetY = margin;
      pdf.addImage(
        imageData,
        'PNG',
        offsetX,
        offsetY,
        renderWidth,
        renderHeight,
        undefined,
        'FAST',
      );

      if (!pageTargets.length && !singlePage && scaledHeight > usableHeight) {
        let heightLeft = scaledHeight - usableHeight;
        while (heightLeft > 0) {
          pdf.addPage();
          const positionY = margin - (scaledHeight - heightLeft);
          pdf.addImage(
            imageData,
            'PNG',
            margin,
            positionY,
            usableWidth,
            scaledHeight,
            undefined,
            'FAST',
          );
          heightLeft -= usableHeight;
        }
      }
    }

    pdf.autoPrint();
    return URL.createObjectURL(pdf.output('blob'));
  }

  private async presentPrintImages(
    printWindow: Window,
    imageUrls: string[],
  ): Promise<void> {
    const printableHtml = this.buildPrintImageHtml(imageUrls);

    printWindow.document.open();
    printWindow.document.write(printableHtml);
    printWindow.document.close();

    await this.waitForWindowReady(printWindow);
    await this.waitForImages(printWindow.document);
    await this.runPrintDialog(printWindow);
  }

  private waitForWindowReady(printWindow: Window): Promise<void> {
    return new Promise((resolve) => {
      if (printWindow.document.readyState === 'complete') {
        resolve();
        return;
      }

      printWindow.addEventListener('load', () => resolve(), { once: true });
      window.setTimeout(() => resolve(), 300);
    });
  }

  private waitForImages(frameDocument: Document): Promise<void> {
    const images = Array.from(frameDocument.images || []);
    if (!images.length) {
      return Promise.resolve();
    }

    return Promise.all(
      images.map(
        (image) =>
          new Promise<void>((resolve) => {
            if (image.complete) {
              resolve();
              return;
            }

            image.addEventListener('load', () => resolve(), { once: true });
            image.addEventListener('error', () => resolve(), { once: true });
            window.setTimeout(() => resolve(), 1200);
          }),
      ),
    ).then(() => undefined);
  }

  private presentPdf(printWindow: Window, pdfUrl: string): Promise<void> {
    return new Promise((resolve) => {
      const cleanup = () => {
        window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
      };

      printWindow.addEventListener(
        'beforeunload',
        () => URL.revokeObjectURL(pdfUrl),
        { once: true },
      );
      printWindow.addEventListener(
        'load',
        () => {
          cleanup();
          printWindow.focus();
          resolve();
        },
        { once: true },
      );

      printWindow.location.replace(pdfUrl);
      window.setTimeout(() => {
        cleanup();
        printWindow.focus();
        resolve();
      }, 1200);
    });
  }

  private runPrintDialog(printWindow: Window): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      let dialogOpened = false;

      const cleanup = () => {
        printWindow.removeEventListener('afterprint', handleAfterPrint);
        printWindow.removeEventListener('blur', handleBlur);
        printWindow.removeEventListener('focus', handleFocus);
      };

      const finish = () => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        resolve();
      };

      const handleAfterPrint = () => finish();

      const handleBlur = () => {
        dialogOpened = true;
      };

      const handleFocus = () => {
        if (dialogOpened) {
          finish();
        }
      };

      printWindow.addEventListener('afterprint', handleAfterPrint);
      printWindow.addEventListener('blur', handleBlur);
      printWindow.addEventListener('focus', handleFocus);

      printWindow.focus();
      printWindow.print();

      window.setTimeout(() => {
        if (!dialogOpened) {
          finish();
        }
      }, 2500);
      window.setTimeout(() => finish(), 30000);
    });
  }

  private buildPrintImageHtml(imageUrls: string[]): string {
    const pagesHtml = imageUrls
      .map(
        (imageUrl) => `
          <div class="print-page">
            <img src="${imageUrl}" alt="Ticket preview" />
          </div>
        `,
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title></title>
          <style>
            @page {
              size: A4;
              margin: 0;
            }

            html, body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            body {
              padding: 0;
              background: #ffffff;
            }

            .print-page {
              width: 210mm;
              min-height: 297mm;
              margin: 0 auto;
              background: #ffffff;
              page-break-after: always;
              break-after: page;
            }

            .print-page:last-child {
              margin-bottom: 0;
              page-break-after: auto;
              break-after: auto;
            }

            .print-page img {
              display: block;
              width: 100%;
              height: auto;
            }

            @media print {
              body {
                padding: 0;
                background: #ffffff;
              }

              .print-page {
                margin: 0;
                box-shadow: none;
              }
            }
          </style>
        </head>
        <body>${pagesHtml}</body>
      </html>
    `;
  }

  private safeCloseWindow(printWindow: Window): void {
    try {
      printWindow.close();
    } catch {
      // Ignore window close failures during cleanup.
    }
  }
}
