import { CommonModule } from "@angular/common";
import { Component, HostBinding, Input, OnInit } from "@angular/core";

import icons from "./icons";

@Component({
  selector: "app-keenicon",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./keenicon.component.html",
})
export class KeeniconComponent implements OnInit {
  @Input() name!: string;
  @Input() class: string | null = null;
  @Input() type = "duotone";

  pathsNumber = 0;

  ngOnInit(): void {
    if (this.type === "duotone") {
      // @ts-ignore icons registry for duotone path counts.
      this.pathsNumber = icons[this.type + "-paths"][this.name] ?? 0;
    }
  }

  @HostBinding("style.display")
  get styleDisplay(): string {
    return "contents";
  }
}
