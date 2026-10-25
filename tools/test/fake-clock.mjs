const RD = Date, off = Date.parse(process.env.FAKE_NOW) - RD.now();
globalThis.Date = new Proxy(RD, {
  construct(t, a, nt) { return Reflect.construct(t, a.length ? a : [RD.now() + off], nt); },
  get(t, p, r) { return p === "now" ? () => RD.now() + off : Reflect.get(t, p, r); },
  apply() { return new globalThis.Date().toString(); }
});
