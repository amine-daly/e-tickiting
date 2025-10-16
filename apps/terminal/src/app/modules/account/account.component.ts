import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DropdownMenu1Component } from '../../_metronic/partials/content/dropdown-menus/dropdown-menu1/dropdown-menu1.component';
import { KeeniconComponent } from 'src/app/_metronic/shared/keenicon/keenicon.component';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    DropdownMenu1Component,
    KeeniconComponent,
  ],
  templateUrl: './account.component.html',
})
export class AccountComponent implements OnInit {
  constructor() {}

  ngOnInit(): void {}
}
