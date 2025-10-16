import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KeeniconComponent } from 'src/app/_metronic/shared/keenicon/keenicon.component';

type Tabs =
  | 'kt_table_widget_5_tab_1'
  | 'kt_table_widget_5_tab_2'
  | 'kt_table_widget_5_tab_3';

@Component({
  selector: 'app-tables-widget5',
  templateUrl: './tables-widget5.component.html',
  standalone: true,
  imports: [CommonModule, KeeniconComponent],
})
export class TablesWidget5Component implements OnInit {
  constructor() {}

  activeTab: Tabs = 'kt_table_widget_5_tab_1';

  setTab(tab: Tabs) {
    this.activeTab = tab;
  }

  activeClass(tab: Tabs) {
    return tab === this.activeTab ? 'show active' : '';
  }

  ngOnInit(): void {}
}
