import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SplashScreenComponent } from './splash-screen.component';

@NgModule({
  imports: [CommonModule, SplashScreenComponent],
  exports: [SplashScreenComponent],
})
export class SplashScreenModule {}
