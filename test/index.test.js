import { expect } from 'chai';
import request from 'supertest';
import express from 'express';
import * as sqlite from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.use(express.json());

let db;

before(async () => {
    db = await sqlite.open({
        filename: './price_plans/data_plan.db',
        driver: sqlite3.Database
    });

    await db.migrate();

    // Setup routes
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
});

describe('API Tests', () => {

    it('GET /api/price_plans should return all price plans', async () => {
        const res = await request(app).get('/api/price_plans');
        expect(res.status).to.equal(200);
        expect(res.body).to.be.an('array');
    });

    it('POST /api/price_plan/create should create a new price plan', async () => {
        const res = await request(app)
            .post('/api/price_plan/create')
            .send({ name: 'Test Plan', call_cost: 1.5, sms_cost: 0.5 });
        
        expect(res.status).to.equal(200);
        expect(res.body.message).to.equal('Price plan created successfully');

        const plans = await db.all('select * from price_plan where plan_name = ?', ['Test Plan']);
        expect(plans.length).to.equal(1);
        expect(plans[0].plan_name).to.equal('Test Plan');
        expect(plans[0].call_price).to.equal(1.5);
        expect(plans[0].sms_price).to.equal(0.5);
    });

    it('POST /api/phonebill should calculate the total bill', async () => {
        const res = await request(app)
            .post('/api/phonebill')
            .send({ price_plan: 'Test Plan', actions: 'call, sms, call' });
        
        expect(res.status).to.equal(200);
        expect(res.body.total).to.equal('3.50'); // 1.5 (call) + 0.5 (sms) + 1.5 (call)
    });

    it('POST /api/price_plan/update should update an existing price plan', async () => {
        const res = await request(app)
            .post('/api/price_plan/update')
            .send({ name: 'Test Plan', call_cost: 2.0, sms_cost: 1.0 });
        
        expect(res.status).to.equal(200);
        expect(res.body.message).to.equal('Price plan updated successfully');

        const updatedPlan = await db.get('select * from price_plan where plan_name = ?', ['Test Plan']);
        expect(updatedPlan.call_price).to.equal(2.0);
        expect(updatedPlan.sms_price).to.equal(1.0);
    });

    it('POST /api/price_plan/delete should delete a price plan', async () => {
        const planToDelete = await db.get('select * from price_plan where plan_name = ?', ['Test Plan']);
        
        const res = await request(app)
            .post('/api/price_plan/delete')
            .send({ id: planToDelete.id });
        
        expect(res.status).to.equal(200);
        expect(res.body.message).to.equal('Price plan deleted successfully');

        const deletedPlan = await db.get('select * from price_plan where id = ?', [planToDelete.id]);
        expect(deletedPlan).to.be.undefined;
    });
});

after(async () => {
    await db.close();
});
