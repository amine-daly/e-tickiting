import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { KeeniconComponent } from 'src/app/_metronic/shared/keenicon/keenicon.component';
import { Subscription } from 'rxjs';
import { RouterLink } from '@angular/router';
import { PaginationComponent } from 'src/app/shared/components/pagination/pagination.component';
import { TeamService } from './team.service';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ReactiveFormsModule,
    KeeniconComponent,
    RouterLink,
    PaginationComponent,
  ],
  selector: 'app-team',
  templateUrl: './team.component.html',
  styleUrls: ['./team.component.scss'],
})
export class TeamComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();

  accounts$ = this.teamService.accounts$;
  loading$ = this.teamService.loading$;
  pagination$ = this.teamService.pagination$;

  page = 1;
  pageSize = 9;
  defaultAvatar = 'assets/media/avatars/300-1.jpg';

  constructor(private teamService: TeamService) {}

  ngOnInit(): void {
    this.loadPage(1);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  onPageChange(page: number): void {
    this.loadPage(page);
  }

  private loadPage(page: number): void {
    const posId = localStorage.getItem('posId') || '';
    this.page = page;
    const sub = this.teamService
      .getAccountsByTarget(posId, this.page - 1, this.pageSize)
      .subscribe();
    this.subscriptions.add(sub);
  }
}
