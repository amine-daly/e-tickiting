import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';

import { HeaderComponent } from '../header/header.component';
import { FooterComponent } from '../footer/footer.component';
@Component({
  standalone: true,
  imports: [CommonModule, HeaderComponent, RouterModule, FooterComponent],
  selector: 'app-main-layout',
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.scss'],
})
export class MainLayoutComponent implements OnInit {
  ngOnInit(): void {}

  showButton: boolean = false;

  scrollThreshold: number = 500;

  constructor() {}

  @HostListener('window:scroll', [])
  onWindowScroll() {
    // Get the current scroll position
    const scrollPosition =
      window.pageYOffset ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0;

    // Update the variable based on the scroll position
    this.showButton = scrollPosition >= this.scrollThreshold;
  }

  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  circumference: number = 307.919; // Circumference of the circle
  strokeOffset: number = this.circumference;

  @HostListener('window:scroll', [])
  onScroll() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight =
      document.documentElement.scrollHeight -
      document.documentElement.clientHeight;

    // Show the button if scrolled past 500px
    this.showButton = scrollTop > 500;

    // Calculate progress (scroll percentage)
    const progress = Math.min(scrollTop / docHeight, 1); // Max is 1 (100%)
    this.strokeOffset = this.circumference * (1 - progress);
  }
}
