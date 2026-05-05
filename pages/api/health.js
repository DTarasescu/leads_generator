export default function handler(req, res) {
  res.status(200).json({ status: "ok", service: "leads-generator", ts: new Date().toISOString() });
}
