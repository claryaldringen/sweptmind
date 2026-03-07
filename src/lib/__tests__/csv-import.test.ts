import { describe, it, expect } from "vitest";
import { parseCSV, mapOutlookTaskRow, parseDate } from "../csv-import";

describe("parseCSV", () => {
  it("parsuje čárkový separátor", () => {
    const csv = "Subject,Due Date,Status\nBuy milk,2026-03-10,Not Started\nCall dentist,,Completed";
    const result = parseCSV(csv);
    expect(result.headers).toEqual(["Subject", "Due Date", "Status"]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({
      Subject: "Buy milk",
      "Due Date": "2026-03-10",
      Status: "Not Started",
    });
    expect(result.rows[1]).toEqual({
      Subject: "Call dentist",
      "Due Date": "",
      Status: "Completed",
    });
  });

  it("parsuje středníkový separátor", () => {
    const csv = "Předmět;Datum splnění;Stav\nKoupit mléko;10.03.2026;Dokončeno";
    const result = parseCSV(csv);
    expect(result.headers).toEqual(["Předmět", "Datum splnění", "Stav"]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]["Předmět"]).toBe("Koupit mléko");
  });

  it("podporuje quoted pole s čárkami", () => {
    const csv = 'Subject,Notes,Status\n"Buy eggs, milk",Some note,Not Started';
    const result = parseCSV(csv);
    expect(result.rows[0].Subject).toBe("Buy eggs, milk");
    expect(result.rows[0].Notes).toBe("Some note");
  });

  it("podporuje escaped uvozovky uvnitř quoted polí", () => {
    const csv = 'Subject,Notes\n"Task ""important""","Note with ""quotes"""';
    const result = parseCSV(csv);
    expect(result.rows[0].Subject).toBe('Task "important"');
    expect(result.rows[0].Notes).toBe('Note with "quotes"');
  });

  it("přeskočí prázdné řádky", () => {
    const csv = "Subject,Status\nTask 1,Not Started\n\nTask 2,Completed\n";
    const result = parseCSV(csv);
    expect(result.rows).toHaveLength(2);
  });

  it("vrátí prázdný výsledek pro prázdný vstup", () => {
    const result = parseCSV("");
    expect(result.headers).toEqual([]);
    expect(result.rows).toEqual([]);
  });

  it("vrátí prázdné rows pro CSV jen s hlavičkou", () => {
    const csv = "Subject,Due Date,Status";
    const result = parseCSV(csv);
    expect(result.headers).toEqual(["Subject", "Due Date", "Status"]);
    expect(result.rows).toEqual([]);
  });

  it("zvládne Windows CRLF konce řádků", () => {
    const csv = "Subject,Status\r\nTask 1,Not Started\r\nTask 2,Completed";
    const result = parseCSV(csv);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].Subject).toBe("Task 1");
  });

  it("zvládne quoted pole s novými řádky", () => {
    const csv = 'Subject,Notes\nTask 1,"Line 1\nLine 2"';
    const result = parseCSV(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].Notes).toBe("Line 1\nLine 2");
  });

  it("vrátí headers a prázdné rows pro CSV jen s hlavičkou a trailing newline", () => {
    const csv = "Subject,Due Date,Status\n";
    const result = parseCSV(csv);
    expect(result.headers).toEqual(["Subject", "Due Date", "Status"]);
    expect(result.rows).toEqual([]);
  });

  it("zvládne nekompletní uvozovky (neuzavřený quoted field)", () => {
    const csv = 'Subject,Notes\n"Unclosed quote,Some note';
    const result = parseCSV(csv);
    // Neuzavřená uvozovka zachytí zbytek řádku jako jedno pole
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].Subject).toBeDefined();
  });

  it("zvládne řádek s méně hodnotami než hlaviček", () => {
    const csv = "Subject,Notes,Status\nOnly subject";
    const result = parseCSV(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].Subject).toBe("Only subject");
    expect(result.rows[0].Notes).toBe("");
    expect(result.rows[0].Status).toBe("");
  });

  it("zvládne řádek s více hodnotami než hlaviček", () => {
    const csv = "Subject,Notes\nTask,Note,Extra value";
    const result = parseCSV(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].Subject).toBe("Task");
    expect(result.rows[0].Notes).toBe("Note");
  });

  it("zvládne uvozovky uprostřed neuvozovaného pole", () => {
    const csv = 'Subject,Notes\nTask with "quotes" inside,Normal note';
    const result = parseCSV(csv);
    expect(result.rows).toHaveLength(1);
    // Uvozovky se zpracují jako přepnutí quoted režimu
    expect(result.rows[0].Subject).toBeDefined();
  });
});

describe("parseDate", () => {
  it("parsuje ISO formát YYYY-MM-DD", () => {
    expect(parseDate("2026-03-10")).toBe("2026-03-10");
  });

  it("parsuje US formát MM/DD/YYYY", () => {
    expect(parseDate("03/10/2026")).toBe("2026-03-10");
  });

  it("parsuje EU formát DD.MM.YYYY", () => {
    expect(parseDate("10.03.2026")).toBe("2026-03-10");
  });

  it("parsuje krátký EU formát D.M.YYYY", () => {
    expect(parseDate("5.3.2026")).toBe("2026-03-05");
  });

  it("vrátí null pro prázdný string", () => {
    expect(parseDate("")).toBeNull();
  });

  it("vrátí null pro nerozpoznaný formát", () => {
    expect(parseDate("next Monday")).toBeNull();
  });
});

describe("mapOutlookTaskRow", () => {
  it("mapuje kompletní řádek", () => {
    const row = {
      Subject: "Buy milk",
      "Due Date": "2026-03-10",
      Status: "Not Started",
      Notes: "From the store",
      Categories: "Shopping",
    };
    const result = mapOutlookTaskRow(row);
    expect(result).toEqual({
      title: "Buy milk",
      dueDate: "2026-03-10",
      isCompleted: false,
      notes: "From the store",
      listName: "Shopping",
    });
  });

  it("mapuje dokončený úkol", () => {
    const row = { Subject: "Done task", Status: "Completed" };
    const result = mapOutlookTaskRow(row);
    expect(result?.isCompleted).toBe(true);
  });

  it("mapuje české názvy sloupců", () => {
    const row = {
      Předmět: "Koupit mléko",
      "Datum splnění": "10.03.2026",
      Stav: "Dokončeno",
      Poznámky: "Z obchodu",
      Kategorie: "Nákupy",
    };
    const result = mapOutlookTaskRow(row);
    expect(result).toEqual({
      title: "Koupit mléko",
      dueDate: "2026-03-10",
      isCompleted: true,
      notes: "Z obchodu",
      listName: "Nákupy",
    });
  });

  it("vrátí null pro řádek bez titulku", () => {
    const row = { Status: "Not Started", Notes: "No subject" };
    expect(mapOutlookTaskRow(row)).toBeNull();
  });

  it("vrátí null pro řádek s prázdným titulkem", () => {
    const row = { Subject: "  ", Status: "Not Started" };
    expect(mapOutlookTaskRow(row)).toBeNull();
  });

  it("zvládne chybějící sloupce", () => {
    const row = { Subject: "Simple task" };
    const result = mapOutlookTaskRow(row);
    expect(result).toEqual({
      title: "Simple task",
      dueDate: null,
      isCompleted: false,
      notes: null,
      listName: null,
    });
  });

  it("mapuje % Complete = 100 jako dokončený", () => {
    const row = { Subject: "Task", "% Complete": "100" };
    const result = mapOutlookTaskRow(row);
    expect(result?.isCompleted).toBe(true);
  });

  it("mapuje US formát data", () => {
    const row = { Subject: "Task", "Due Date": "12/25/2026" };
    const result = mapOutlookTaskRow(row);
    expect(result?.dueDate).toBe("2026-12-25");
  });
});
