import { Component, computed, inject, input, forwardRef } from "@angular/core";
import { AnalysisService } from "./analysis-service";

@Component({
  imports: [forwardRef(() => StatusPipe)],
  selector: "app-image-analysis",
  styles: `
    th,
    td {
      white-space: nowrap;
    }
    td.wrap,
    th.wrap {
      max-width: 200px;
      white-space: normal;
      overflow-wrap: break-word;
    }
  `,
  template: `
    @if (dataList() !== null) {
      <table>
        <thead>
          <tr>
            <th class="wrap">Emoji File</th>
            <th>sRGB (R,G,B)</th>
            <th>CIELAB (L*,a*,b*)</th>
            <th>Transparency (%)</th>
            <th>Edge density (%)</th>
            <th>Status</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          @for (row of dataList(); track row.filename) {
            <tr>
              <td class="wrap">{{ row.filename }}</td>
              <td>{{ row.srgb }}</td>
              <td>{{ row.cielab }}</td>
              <td>{{ row.transparency }}</td>
              <td>{{ row["edge-density"] }}</td>
              <td>{{ row.status | status: row.reason }}</td>
              <td>{{ row.reason }}</td>
            </tr>
          }
        </tbody>
      </table>
    }
  `,
})
export class ImageAnalysis {
  private readonly service = inject(AnalysisService);
  readonly dataResource = input.required<string>();

  readonly dataList = computed(() => {
    return this.dataResource() ? this.service.fromCsv(this.dataResource()) : null;
  });
}

import { Pipe, PipeTransform } from "@angular/core";

@Pipe({
  name: "status",
  pure: true,
})
export class StatusPipe implements PipeTransform {
  transform(value: string, reason: string): string {
    if (value === "active") {
      return "Ok";
    } else if (value === "inactive") {
      return reason;
    } else {
      return value;
    }
  }
}
