import { Service } from "@angular/core";
import { parse } from "csv-parse/browser/esm/sync";
import type { EmojiAnalysisCsvRow } from "./emoji-analysis-row";

@Service()
export class AnalysisService {
  fromCsv(csvText: string): EmojiAnalysisCsvRow[] {
    return parse(csvText, {
      columns: true,
      bom: true,
      skip_empty_lines: true,
    }) as EmojiAnalysisCsvRow[];
  }
}
