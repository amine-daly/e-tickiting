import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter, Subject, takeUntil } from 'rxjs';
import { KeeniconComponent } from 'src/app/_metronic/shared/keenicon/keenicon.component';
import { MobileShellService } from 'src/app/core/services/mobile-shell.service';

interface NavTab {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-mobile-footer',
  standalone: true,
  imports: [CommonModule, KeeniconComponent],
  templateUrl: './mobile-footer.component.html',
  styleUrls: ['./mobile-footer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileFooterComponent implements OnInit, OnDestroy {
  leftTabs: NavTab[] = [
    { label: 'Dashboard', icon: 'element-11', route: '/dashboard' },
    { label: 'Trips', icon: 'arrow-right-left', route: '/trips' },
  ];

  rightTabs: NavTab[] = [
    { label: 'Buses', icon: 'bus', route: '/buses' },
    { label: 'Tickets', icon: 'bill', route: '/tickets' },
  ];

  /** Normalized path (no query/hash) used for active tab highlighting. */
  activeUrl = '/';

  private readonly destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private mobileShell: MobileShellService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.activeUrl = this.normalizeUrl(this.router.url);

    this.router.events
      .pipe(
        filter(
          (event): event is NavigationEnd => event instanceof NavigationEnd,
        ),
        takeUntil(this.destroy$),
      )
      .subscribe((event) => {
        this.activeUrl = this.normalizeUrl(event.urlAfterRedirects);
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  navigate(route: string): void {
    void this.router.navigateByUrl(route);
  }

  isActive(route: string): boolean {
    return this.activeUrl === route || this.activeUrl.startsWith(`${route}/`);
  }

  openScan(): void {
    this.mobileShell.requestScan();
  }

  private normalizeUrl(url: string): string {
    return url.split('?')[0].split('#')[0];
  }
}
