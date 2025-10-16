import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-widgets-examples',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './widgets-examples.component.html',
  styleUrls: ['./widgets-examples.component.scss'],
})
export class WidgetsExamplesComponent implements OnInit {
  constructor() {}

  ngOnInit(): void {}
}
