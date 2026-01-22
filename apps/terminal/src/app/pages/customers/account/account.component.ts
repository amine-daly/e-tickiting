import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { KeeniconComponent } from 'src/app/_metronic/shared/keenicon/keenicon.component';
import { CustomersService } from '../customers.service';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [CommonModule, RouterModule, KeeniconComponent],
  templateUrl: './account.component.html',
})
export class AccountComponent implements OnInit {
  user$ = this.customersService.user$;
  defaultAvatar = 'assets/media/avatars/300-1.jpg';

  constructor(private customersService: CustomersService) {}

  ngOnInit(): void {}
}
