import express from 'express';
import * as sqlite from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 4011;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// SQLite setup
const db = await sqlite.open({
    filename: './price_plans/data_plan.db',
    driver: sqlite3.Database
});

// Migrate database
await db.migrate();

// API Routes
app.get('/api/price_plans', async (req, res) => {
    const pricePlans = await db.all('select * from price_plan');
    res.json(pricePlans);
});

app.post('/api/price_plan/create', async (req, res) => {
    const { name, call_cost, sms_cost } = req.body;
    await db.run('insert into price_plan (plan_name, sms_price, call_price) values (?, ?, ?)', [name, sms_cost, call_cost]);
    res.json({ message: 'Price plan created successfully' });
});

app.post('/api/price_plan/update', async (req, res) => {
    const { name, call_cost, sms_cost } = req.body;
    await db.run('update price_plan set call_price = ?, sms_price = ? where plan_name = ?', [call_cost, sms_cost, name]);
    res.json({ message: 'Price plan updated successfully' });
});

app.post('/api/price_plan/delete', async (req, res) => {
    const { id } = req.body;
    await db.run('delete from price_plan where id = ?', [id]);
    res.json({ message: 'Price plan deleted successfully' });
});

app.post('/api/phonebill', async (req, res) => {
    const { price_plan, actions } = req.body;
    const plan = await db.get('select * from price_plan where plan_name = ?', [price_plan]);

    if (!plan) {
        return res.status(404).json({ error: 'Price plan not found' });
    }

    let total = 0;
    actions.split(',').forEach(action => {
        if (action.trim() === 'call') {
            total += plan.call_price;
        } else if (action.trim() === 'sms') {
            total += plan.sms_price;
        }
    });

    res.json({ total: total.toFixed(2) });
});

// Serve the main HTML file for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => console.log(`Server started on ${PORT}`));
