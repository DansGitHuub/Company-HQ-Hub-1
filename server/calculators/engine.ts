// ─── Public types ─────────────────────────────────────────────────────────────

export type LineItemDraft = {
  item_type: "service" | "material" | "labor" | "equipment" | "subcontracting";
  class_id: number | null;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  amount: number;
  is_optional: boolean;
  sort_order: number;
};

export type RunContext = {
  laborRate: number;
  productionRates: Record<string, number>;
  complexityMultipliers: Record<string, number>;
  classPricingDefaults: Map<number, { overhead_pct: number; profit_margin_pct: number }> | null;
};

export type RunResult = {
  lineItems: LineItemDraft[];
  summary: {
    totalAmount: number;
    lineItemCount: number;
    derived: Record<string, number>;
  };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const VALID_ITEM_TYPES = new Set<LineItemDraft["item_type"]>([
  "service",
  "material",
  "labor",
  "equipment",
  "subcontracting",
]);

function coerceItemType(raw: unknown): LineItemDraft["item_type"] {
  if (typeof raw === "string" && VALID_ITEM_TYPES.has(raw as LineItemDraft["item_type"])) {
    return raw as LineItemDraft["item_type"];
  }
  return "service";
}

function interpolateDescription(template: string, scope: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_: string, key: string) => {
    const val = scope[key];
    return val !== undefined ? String(val) : `{${key}}`;
  });
}

// ─── Input validation ─────────────────────────────────────────────────────────

function validateInputs(
  inputSchema: unknown,
  raw: Record<string, unknown>
): Record<string, unknown> {
  const validated: Record<string, unknown> = {};
  const schema = inputSchema as { inputs?: unknown[] } | null | undefined;
  const declared: unknown[] = schema?.inputs ?? [];

  for (const field of declared) {
    const f = field as {
      name: string;
      type: "number" | "select";
      default?: unknown;
      min?: number;
      options?: { value: string }[];
    };

    let value: unknown = raw[f.name] !== undefined ? raw[f.name] : f.default;

    if (value === undefined) {
      throw new Error(`Missing required calculator input '${f.name}' with no declared default`);
    }

    if (f.type === "number") {
      value = Number(value);
      if (!isFinite(value as number)) {
        throw new Error(
          `Calculator input '${f.name}' must be a finite number, got '${raw[f.name]}'`
        );
      }
      if (f.min !== undefined && (value as number) < f.min) {
        throw new Error(
          `Calculator input '${f.name}' must be >= ${f.min}, got ${value}`
        );
      }
    } else if (f.type === "select") {
      const options = (f.options ?? []).map((o) => o.value);
      if (!options.includes(String(value))) {
        throw new Error(
          `Calculator input '${f.name}' must be one of [${options.join(", ")}], got '${value}'`
        );
      }
    }

    validated[f.name] = value;
  }

  return validated;
}

// ─── Safe whitelisted expression evaluator ────────────────────────────────────
//
// Supports: number literals, string literals (bracket keys only), parentheses,
// binary ops + - * /, unary minus, identifier lookup against evalScope,
// member access via dot (.prop) or bracket ([ident] or ['string']),
// and Math.round / Math.floor / Math.ceil / Math.min / Math.max calls.
//
// Does NOT use eval, Function, or new Function.

type TokenType =
  | "NUMBER"
  | "STRING"
  | "IDENT"
  | "LPAREN"
  | "RPAREN"
  | "LBRACKET"
  | "RBRACKET"
  | "DOT"
  | "PLUS"
  | "MINUS"
  | "STAR"
  | "SLASH"
  | "COMMA"
  | "EOF";

interface Token {
  type: TokenType;
  value?: number | string;
}

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];

    // Whitespace
    if (/\s/.test(ch)) { i++; continue; }

    // Number literal (including leading-dot floats like .5)
    if (/[0-9]/.test(ch) || (ch === "." && i + 1 < src.length && /[0-9]/.test(src[i + 1]))) {
      let num = "";
      while (i < src.length && /[0-9.]/.test(src[i])) num += src[i++];
      tokens.push({ type: "NUMBER", value: parseFloat(num) });
      continue;
    }

    // String literal (single or double quotes)
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let str = "";
      i++;
      while (i < src.length && src[i] !== quote) str += src[i++];
      if (src[i] !== quote) throw new Error(`Unterminated string literal in expression`);
      i++;
      tokens.push({ type: "STRING", value: str });
      continue;
    }

    // Identifier
    if (/[A-Za-z_$]/.test(ch)) {
      let id = "";
      while (i < src.length && /[A-Za-z0-9_$]/.test(src[i])) id += src[i++];
      tokens.push({ type: "IDENT", value: id });
      continue;
    }

    // Single-character tokens
    const singles: Partial<Record<string, TokenType>> = {
      "(": "LPAREN", ")": "RPAREN",
      "[": "LBRACKET", "]": "RBRACKET",
      ".": "DOT",
      "+": "PLUS", "-": "MINUS", "*": "STAR", "/": "SLASH",
      ",": "COMMA",
    };
    const tt = singles[ch];
    if (tt) { tokens.push({ type: tt }); i++; continue; }

    throw new Error(
      `Unexpected character '${ch}' in expression near '${src.slice(Math.max(0, i - 5), i + 6)}'`
    );
  }
  tokens.push({ type: "EOF" });
  return tokens;
}

// The only functions allowed to be called are these five.
const SAFE_CALLABLES = new Set<unknown>([
  Math.round, Math.floor, Math.ceil, Math.min, Math.max,
]);

class ExprParser {
  private pos = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly scope: Record<string, unknown>
  ) {}

  private peek(): Token { return this.tokens[this.pos]; }
  private consume(): Token { return this.tokens[this.pos++]; }

  private expect(type: TokenType): Token {
    const t = this.consume();
    if (t.type !== type) {
      throw new Error(`Expected '${type}' but got '${t.type}' in expression`);
    }
    return t;
  }

  parse(): number {
    const val = this.parseAddSub();
    const remaining = this.peek();
    if (remaining.type !== "EOF") {
      throw new Error(`Unexpected token '${remaining.type}' after expression end`);
    }
    return val;
  }

  private parseAddSub(): number {
    let left = this.parseMulDiv();
    while (this.peek().type === "PLUS" || this.peek().type === "MINUS") {
      const op = this.consume().type;
      const right = this.parseMulDiv();
      left = op === "PLUS" ? left + right : left - right;
    }
    return left;
  }

  private parseMulDiv(): number {
    let left = this.parseUnary();
    while (this.peek().type === "STAR" || this.peek().type === "SLASH") {
      const op = this.consume().type;
      const right = this.parseUnary();
      if (op === "SLASH" && right === 0) throw new Error("Division by zero in expression");
      left = op === "STAR" ? left * right : left / right;
    }
    return left;
  }

  private parseUnary(): number {
    if (this.peek().type === "MINUS") {
      this.consume();
      return -this.parsePrimary();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    const t = this.peek();

    if (t.type === "NUMBER") {
      this.consume();
      return t.value as number;
    }

    if (t.type === "LPAREN") {
      this.consume();
      const val = this.parseAddSub();
      this.expect("RPAREN");
      return val;
    }

    if (t.type === "IDENT") {
      return this.resolveIdentChain();
    }

    throw new Error(`Unexpected token '${t.type}' in expression — only numbers, identifiers, and parenthesised sub-expressions are allowed`);
  }

  // Resolves an identifier optionally followed by .prop, [key], or (args) postfix chains.
  private resolveIdentChain(): number {
    const identTok = this.consume();
    const name = identTok.value as string;

    if (!(name in this.scope)) {
      throw new Error(
        `Unknown identifier '${name}' — not in expression scope. ` +
        `Available: ${Object.keys(this.scope).join(", ")}`
      );
    }

    let obj: unknown = this.scope[name];

    while (true) {
      const next = this.peek();

      // Dot-property access: obj.prop
      if (next.type === "DOT") {
        this.consume();
        const keyTok = this.expect("IDENT");
        const key = keyTok.value as string;
        if (typeof obj !== "object" || obj === null) {
          throw new Error(`Cannot access property '${key}' on non-object`);
        }
        obj = (obj as Record<string, unknown>)[key];
        continue;
      }

      // Bracket-key access: obj[ident] or obj['string']
      if (next.type === "LBRACKET") {
        this.consume();
        let key: string;
        const keyTok = this.peek();
        if (keyTok.type === "STRING") {
          this.consume();
          key = keyTok.value as string;
        } else if (keyTok.type === "IDENT") {
          this.consume();
          const kv = this.scope[keyTok.value as string];
          if (typeof kv !== "string" && typeof kv !== "number") {
            throw new Error(
              `Bracket key '${keyTok.value}' must resolve to a string or number, ` +
              `got ${typeof kv}`
            );
          }
          key = String(kv);
        } else {
          throw new Error(
            `Bracket accessor must be a string literal or identifier, got '${keyTok.type}'`
          );
        }
        this.expect("RBRACKET");
        if (typeof obj !== "object" || obj === null) {
          throw new Error(`Cannot index non-object with key '${key}'`);
        }
        obj = (obj as Record<string, unknown>)[key];
        continue;
      }

      // Function call: fn(args) — only whitelisted Math functions allowed
      if (next.type === "LPAREN") {
        this.consume();
        if (!SAFE_CALLABLES.has(obj)) {
          throw new Error(
            `Only Math.round / Math.floor / Math.ceil / Math.min / Math.max ` +
            `are callable in expressions`
          );
        }
        const fn = obj as (...args: number[]) => number;
        const args: number[] = [];
        while (this.peek().type !== "RPAREN") {
          args.push(this.parseAddSub());
          if (this.peek().type === "COMMA") this.consume();
        }
        this.expect("RPAREN");
        obj = fn(...args);
        continue;
      }

      break;
    }

    if (typeof obj === "number") return obj;
    if (obj === null || obj === undefined) {
      throw new Error(`'${name}' resolved to ${obj} — cannot use as a number`);
    }
    throw new Error(
      `Expression path starting with '${name}' evaluated to non-numeric type '${typeof obj}' ` +
      `(value: ${JSON.stringify(obj)})`
    );
  }
}

function evalExpr(expr: string, scope: Record<string, unknown>): number {
  const tokens = tokenize(expr);
  return new ExprParser(tokens, scope).parse();
}

// ─── priceWithMargin ─────────────────────────────────────────────────────────
//
// Applies overhead and profit-margin from classPricingDefaults to a base unit
// price.  Formula: priced = unitPrice / (1 - profit_margin_pct) * (1 + overhead_pct)
// Returns unitPrice unchanged when classPricingDefaults is null or has no row
// for classId.

export function priceWithMargin(unitPrice: number, classId: number, ctx: RunContext): number {
  if (!ctx.classPricingDefaults) return unitPrice;
  const row = ctx.classPricingDefaults.get(classId);
  if (!row) return unitPrice;
  const { overhead_pct, profit_margin_pct } = row;
  if (profit_margin_pct >= 1) return unitPrice; // guard: avoid divide-by-zero
  return (unitPrice / (1 - profit_margin_pct)) * (1 + overhead_pct);
}

// ─── Safe Math scope injected into every evalScope ───────────────────────────

const SAFE_MATH_SCOPE: Record<string, unknown> = {
  Math: {
    round: Math.round,
    floor: Math.floor,
    ceil:  Math.ceil,
    min:   Math.min,
    max:   Math.max,
  },
};

// ─── runCalculator ────────────────────────────────────────────────────────────

export function runCalculator(
  def: { input_schema: unknown; formula: unknown; default_class_id: number | null },
  inputs: Record<string, unknown>,
  ctx: RunContext
): RunResult {
  // ── Step (a): validate + fill defaults ──────────────────────────────────────
  const validated = validateInputs(def.input_schema, inputs);

  // ── Step (b): build eval scope ───────────────────────────────────────────────
  const formula = (def.formula ?? {}) as Record<string, unknown>;

  const laborRate: number =
    typeof formula["laborRate"] === "number" ? (formula["laborRate"] as number) : ctx.laborRate;

  const productionRates: Record<string, number> =
    formula["productionRates"] !== null &&
    typeof formula["productionRates"] === "object"
      ? (formula["productionRates"] as Record<string, number>)
      : ctx.productionRates;

  const complexityMultipliers: Record<string, number> =
    formula["complexityMultipliers"] !== null &&
    typeof formula["complexityMultipliers"] === "object"
      ? (formula["complexityMultipliers"] as Record<string, number>)
      : ctx.complexityMultipliers;

  const evalScope: Record<string, unknown> = {
    ...validated,
    laborRate,
    productionRates,
    complexityMultipliers,
    ...SAFE_MATH_SCOPE,
  };

  // ── Step (c): evaluate formula ───────────────────────────────────────────────
  const formulaType = typeof formula["type"] === "string" ? formula["type"] : "expression";
  const lineItems: LineItemDraft[] = [];
  const derived: Record<string, number> = {};

  if (formulaType === "expression") {
    const expr = formula["expression"];
    if (typeof expr !== "string" || !expr.trim()) {
      throw new Error("Formula type 'expression' requires a non-empty 'expression' string");
    }
    const amount = round2(evalExpr(expr, evalScope));
    derived["amount"] = amount;
    lineItems.push({
      item_type: coerceItemType(formula["item_type"]),
      class_id: def.default_class_id,
      description: typeof formula["description"] === "string"
        ? formula["description"]
        : "Calculated line item",
      quantity: 1,
      unit: typeof formula["unit"] === "string" ? formula["unit"] : "job",
      unit_price: amount,
      amount,
      is_optional: Boolean(formula["is_optional"]),
      sort_order: 0,
    });

  } else if (formulaType === "decomposed") {
    const rawItems = formula["lineItems"];
    const formulaLineItems: unknown[] = Array.isArray(rawItems) ? rawItems : [];

    formulaLineItems.forEach((entry, idx) => {
      const fli = entry as Record<string, unknown>;

      const qty = round2(evalExpr(String(fli["qtyExpr"] ?? "0"), evalScope));

      let unitPrice = round2(evalExpr(String(fli["unitPriceExpr"] ?? "0"), evalScope));

      const classId: number | null =
        typeof fli["class_id"] === "number" ? fli["class_id"] : def.default_class_id;

      if (fli["applyClassPricing"] === true && classId !== null) {
        unitPrice = round2(priceWithMargin(unitPrice, classId, ctx));
      }

      const amount = round2(qty * unitPrice);

      const rawDesc = typeof fli["description"] === "string" ? fli["description"] : "";
      const description = interpolateDescription(rawDesc, evalScope);

      derived[`qty_${idx}`] = qty;
      derived[`unit_price_${idx}`] = unitPrice;
      derived[`amount_${idx}`] = amount;

      lineItems.push({
        item_type: coerceItemType(fli["item_type"]),
        class_id: classId,
        description,
        quantity: qty,
        unit: typeof fli["unit"] === "string" ? fli["unit"] : "each",
        unit_price: unitPrice,
        amount,
        is_optional: Boolean(fli["is_optional"]),
        sort_order:
          typeof fli["sort_order"] === "number" ? (fli["sort_order"] as number) : idx,
      });
    });

  } else {
    throw new Error(
      `Unknown formula type '${formulaType}'; expected 'expression' or 'decomposed'`
    );
  }

  // Sort: sort_order ASC, then description ASC
  lineItems.sort((a, b) =>
    a.sort_order !== b.sort_order
      ? a.sort_order - b.sort_order
      : a.description.localeCompare(b.description)
  );

  const totalAmount = round2(lineItems.reduce((s, li) => s + li.amount, 0));

  return {
    lineItems,
    summary: {
      totalAmount,
      lineItemCount: lineItems.length,
      derived,
    },
  };
}
