// Match a decoded QR/barcode text or RFID tag to a known person.
export function matchPersonByText(text, people) {
  const t = (text || '').trim().toLowerCase();
  if (!t) return null;
  return (
    people.find((p) => [p.student_id, p.employee_id, p.lrn].some((v) => v && String(v).toLowerCase() === t)) ||
    people.find((p) => p.name.toLowerCase() === t) ||
    (t.length > 3 ? people.find((p) => p.name.toLowerCase().includes(t)) : null) ||
    null
  );
}