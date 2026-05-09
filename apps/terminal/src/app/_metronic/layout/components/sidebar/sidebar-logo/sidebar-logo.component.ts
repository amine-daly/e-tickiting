import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';

import { LayoutType } from '../../../core/configs/config';
import { LayoutService } from '../../../core/layout.service';
import {
  LOGO_BASE,
  LOGO_DARK,
} from '../../../../../../environments/environment';
import { KeeniconComponent } from '../../../../shared/keenicon/keenicon.component';

@Component({
  selector: 'app-sidebar-logo',
  standalone: true,
  imports: [CommonModule, RouterModule, KeeniconComponent],
  templateUrl: './sidebar-logo.component.html',
  styleUrls: ['./sidebar-logo.component.scss'],
})
export class SidebarLogoComponent implements OnInit, OnDestroy {
  private unsubscribe: Subscription[] = [];
  @Input() toggleButtonClass: string = '';
  @Input() toggleEnabled: boolean;
  @Input() toggleType: string = '';
  @Input() toggleState: string = '';
  currentLayoutType: LayoutType | null;

  toggleAttr: string;
  logodark = LOGO_DARK;
  logobase = LOGO_BASE;
  isSidebarClosed: boolean = false;

  constructor(private layout: LayoutService) {}

  ngOnInit(): void {
    this.toggleAttr = `app-sidebar-${this.toggleType}`;
    const layoutSubscr = this.layout.currentLayoutTypeSubject
      .asObservable()
      .subscribe((layout) => {
        this.currentLayoutType = layout;
      });
    this.unsubscribe.push(layoutSubscr);
  }

  ngOnDestroy() {
    this.unsubscribe.forEach((sb) => sb.unsubscribe());
  }
}
