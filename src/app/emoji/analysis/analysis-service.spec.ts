import { TestBed } from "@angular/core/testing";
import { AnalysisService } from "./analysis-service";

describe("AnalysisService", () => {
  let service: AnalysisService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AnalysisService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  const header = "filename,srgb,cielab,transparency,edge-density,status,reason";
  const sample =
    'emoji_u0023.png,"(89, 88, 88)","(37.7, 0.3, 0.1)",81.6,0.0,inactive,Aussortiert: Transparenzanteil zu hoch (>70.0%)';

  it("parses quoted headers and color values without splitting their commas", () => {
    expect(service.fromCsv(`${header}\n${sample}\n`)).toEqual([
      {
        filename: "emoji_u0023.png",
        srgb: "(89, 88, 88)",
        cielab: "(37.7, 0.3, 0.1)",
        transparency: "81.6",
        "edge-density": "0.0",
        status: "inactive",
        reason: "Aussortiert: Transparenzanteil zu hoch (>70.0%)",
      },
    ]);
  });

  it("supports a BOM, CRLF line endings, and blank lines", () => {
    const rows = service.fromCsv(`\uFEFF${header}\r\n${sample}\r\n\r\n${sample}\r\n`);
    expect(rows).toHaveLength(2);
    expect(rows[0].filename).toBe("emoji_u0023.png");
    expect(rows[0].reason).not.toContain("\r");
  });

  it("supports escaped quotes, commas, and line breaks inside quoted fields", () => {
    const row =
      'emoji_u0023.png,"(89, 88, 88)","(37.7, 0.3, 0.1)",81.6,0.0,inactive,"Grund, mit ""Zitat""\nund Zeilenumbruch"';
    expect(service.fromCsv(`${header}\n${row}`)[0].reason).toBe(
      'Grund, mit "Zitat"\nund Zeilenumbruch',
    );
  });

  it("returns no records for empty or header-only input", () => {
    expect(service.fromCsv("")).toEqual([]);
    expect(service.fromCsv(header)).toEqual([]);
  });

  it("rejects unterminated quoted fields and inconsistent column counts", () => {
    expect(() => service.fromCsv(`${header}\n"unterminated`)).toThrow();
    expect(() => service.fromCsv(`${header}\nemoji_u0023.png`)).toThrow();
  });
});
