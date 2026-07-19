export function printHTML(title, bodyHTML) {
  const w = window.open('', '_blank', 'width=900,height=650');
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body{font-family:Inter,Arial,sans-serif;padding:28px;color:#103038}
  h1{font-size:18px;margin:0 0 2px}
  h2{font-size:13px;margin:0 0 12px;color:#546E7A;font-weight:600}
  .meta{font-size:12px;color:#546E7A;margin-bottom:12px}
  table{width:100%;border-collapse:collapse}
  th,td{border:1px solid #cfd8dc;padding:7px 10px;text-align:left;font-size:12px}
  th{background:#E0F7FA;color:#004D40;text-transform:uppercase;font-size:10px;letter-spacing:.04em}
  .center{text-align:center}
  .badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600}
  .footer{margin-top:20px;font-size:10px;color:#90A4AE}
</style>
</head><body>${bodyHTML}<script>window.onload=function(){setTimeout(function(){window.print();},250);};<\/script></body></html>`);
  w.document.close();
}