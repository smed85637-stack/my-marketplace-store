module.exports = async (req, res) => {
  try {
    const allowed = ['products', 'sellers', 'orders', 'admin', 'upload'];
    const name = req.query.name;

    if (!allowed.includes(name)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const fn = require(`../${name}`);

    const event = {
      httpMethod: req.method,
      headers: req.headers || {},
      queryStringParameters: req.query || {},
      body: req.body ? JSON.stringify(req.body) : ''
    };

    const result = await fn.handler(event);

    Object.entries(result.headers || {}).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    res.status(result.statusCode || 200).send(result.body || '');
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
