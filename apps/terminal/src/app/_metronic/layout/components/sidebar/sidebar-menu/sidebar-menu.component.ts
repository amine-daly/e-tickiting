import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { NavController } from '@ionic/angular/standalone';
import { Router, RouterModule } from '@angular/router';

import { KeeniconComponent } from 'src/app/_metronic/shared/keenicon/keenicon.component';

@Component({
  selector: 'app-sidebar-menu',
  standalone: true,
  imports: [CommonModule, RouterModule, KeeniconComponent, TranslateModule],
  templateUrl: './sidebar-menu.component.html',
  styleUrls: ['./sidebar-menu.component.scss'],
})
export class SidebarMenuComponent implements OnInit {
  constructor(
    private router: Router,
    private navCtrl: NavController,
  ) {}

  ngOnInit(): void {}

  navigateTo(event: Event, path: string): void {
    event.preventDefault();
    this.navCtrl.navigateRoot(path);
  }

  isActive(path: string): boolean {
    return this.router.url.startsWith(path);
  }
}
