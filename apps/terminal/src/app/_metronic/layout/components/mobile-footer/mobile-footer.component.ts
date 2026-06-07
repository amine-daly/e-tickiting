import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonTabBar,
  IonTabButton,
  IonLabel,
} from '@ionic/angular/standalone';
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
  imports: [CommonModule, IonTabBar, IonTabButton, IonLabel, KeeniconComponent],
  templateUrl: './mobile-footer.component.html',
  styleUrls: ['./mobile-footer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileFooterComponent {
  tabs: NavTab[] = [
    { label: 'Dashboard', icon: 'element-11', route: '/dashboard' },
    { label: 'Trips', icon: 'arrow-right-left', route: '/trips' },
    { label: 'Tickets', icon: 'ticket', route: '/tickets' },
  ];

  constructor(
    private router: Router,
    private mobileShell: MobileShellService,
  ) {}

  navigate(route: string): void {
    this.router.navigateByUrl(route);
  }

  isActive(route: string): boolean {
    return this.router.url.startsWith(route);
  }

  openScan(): void {
    this.mobileShell.requestScan();
  }
}
