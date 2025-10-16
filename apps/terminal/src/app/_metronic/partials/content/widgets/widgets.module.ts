import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgApexchartsModule } from 'ng-apexcharts';
import { InlineSVGModule } from 'ng-inline-svg-2';
// Advanced Tables
// Tiles
import { TilesWidget1Component } from './tiles/tiles-widget1/tiles-widget1.component';
import { TilesWidget3Component } from './tiles/tiles-widget3/tiles-widget3.component';
import { TilesWidget10Component } from './tiles/tiles-widget10/tiles-widget10.component';
import { TilesWidget11Component } from './tiles/tiles-widget11/tiles-widget11.component';
import { TilesWidget12Component } from './tiles/tiles-widget12/tiles-widget12.component';
import { TilesWidget13Component } from './tiles/tiles-widget13/tiles-widget13.component';
import { TilesWidget14Component } from './tiles/tiles-widget14/tiles-widget14.component';
// Other
import { DropdownMenusModule } from '../dropdown-menus/dropdown-menus.module';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { ChartsWidget1Component } from './charts/charts-widget1/charts-widget1.component';
import { ChartsWidget2Component } from './charts/charts-widget2/charts-widget2.component';
import { ChartsWidget3Component } from './charts/charts-widget3/charts-widget3.component';
import { ChartsWidget4Component } from './charts/charts-widget4/charts-widget4.component';
import { ChartsWidget5Component } from './charts/charts-widget5/charts-widget5.component';
import { ChartsWidget6Component } from './charts/charts-widget6/charts-widget6.component';
import { ChartsWidget7Component } from './charts/charts-widget7/charts-widget7.component';
import { ChartsWidget8Component } from './charts/charts-widget8/charts-widget8.component';
import { MixedWidget8Component } from './mixed/mixed-widget8/mixed-widget8.component';
import { StatsWidget1Component } from './stats/stats-widget1/stats-widget1.component';
import { StatsWidget2Component } from './stats/stats-widget2/stats-widget2.component';
import { StatsWidget3Component } from './stats/stats-widget3/stats-widget3.component';
import { StatsWidget4Component } from './stats/stats-widget4/stats-widget4.component';
import { StatsWidget5Component } from './stats/stats-widget5/stats-widget5.component';
import { StatsWidget6Component } from './stats/stats-widget6/stats-widget6.component';

import { TablesWidget5Component } from './tables/tables-widget5/tables-widget5.component';

import { TablesWidget16Component } from './_new/tables/tables-widget16/tables-widget16.component';
import { NewChartsWidget8Component } from './_new/charts/new-charts-widget8/new-charts-widget8.component';
@NgModule({
  imports: [
    CommonModule,
    DropdownMenusModule,
    InlineSVGModule,
    NgApexchartsModule,
    NgbDropdownModule,
    // Tiles,
    TilesWidget1Component,
    TilesWidget3Component,
    TilesWidget10Component,
    TilesWidget11Component,
    TilesWidget12Component,
    TilesWidget13Component,
    TilesWidget14Component,
    // Other
    ChartsWidget1Component,
    ChartsWidget2Component,
    ChartsWidget3Component,
    ChartsWidget4Component,
    ChartsWidget5Component,
    ChartsWidget6Component,
    ChartsWidget7Component,
    ChartsWidget8Component,
    MixedWidget8Component,
    StatsWidget1Component,
    StatsWidget2Component,
    StatsWidget3Component,
    StatsWidget4Component,
    StatsWidget5Component,
    StatsWidget6Component,
    TablesWidget5Component,
    TablesWidget16Component,
    NewChartsWidget8Component,
    TablesWidget16Component,
  ],
  exports: [
    // Tiles,
    TilesWidget1Component,
    TilesWidget3Component,
    TilesWidget10Component,
    TilesWidget11Component,
    TilesWidget12Component,
    TilesWidget13Component,
    TilesWidget14Component,
    // Other
    ChartsWidget1Component,
    ChartsWidget2Component,
    ChartsWidget3Component,
    ChartsWidget4Component,
    ChartsWidget5Component,
    ChartsWidget6Component,
    ChartsWidget7Component,
    ChartsWidget8Component,
    MixedWidget8Component,
    StatsWidget1Component,
    StatsWidget2Component,
    StatsWidget3Component,
    StatsWidget4Component,
    StatsWidget5Component,
    StatsWidget6Component,
    TablesWidget5Component,
    TablesWidget16Component,
    NewChartsWidget8Component,
    TablesWidget16Component,
  ],
})
export class WidgetsModule {}
