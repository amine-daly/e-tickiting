import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InlineSVGModule } from 'ng-inline-svg-2';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { ChatInnerComponent } from './chat-inner.component';

@NgModule({
  declarations: [],
  imports: [CommonModule, InlineSVGModule, NgbTooltipModule, ChatInnerComponent],
  exports: [ChatInnerComponent],
})
export class ChatInnerModule {}
