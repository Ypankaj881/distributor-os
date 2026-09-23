// Every API response has the same shape so the frontend can handle them uniformly:
//   success: { success: true,  data, meta? }
//   failure: { success: false, error: { code, message, fields? } }

export function ok(data, { status = 200, meta } = {}) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return Response.json(body, { status });
}

export function created(data) {
  return ok(data, { status: 201 });
}

export function fail({ status = 400, code = "BAD_REQUEST", message, fields }) {
  const error = { code, message };
  if (fields) error.fields = fields;
  return Response.json({ success: false, error }, { status });
}
