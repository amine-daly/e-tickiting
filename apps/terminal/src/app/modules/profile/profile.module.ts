import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InlineSVGModule } from 'ng-inline-svg-2';
import { CampaignsComponent } from './campaigns/campaigns.component';
import { ProfileRoutingModule } from './profile-routing.module';
import { ProfileComponent } from './profile.component';
import { WidgetsModule, DropdownMenusModule } from '../../_metronic/partials';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    ProfileRoutingModule,
    InlineSVGModule,
    DropdownMenusModule,
    WidgetsModule,
    // import standalone feature components
    ProfileComponent,
    CampaignsComponent,
  ],
})
export class ProfileModule {}
