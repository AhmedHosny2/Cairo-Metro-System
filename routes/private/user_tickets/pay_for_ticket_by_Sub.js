const { isEmpty } = require('lodash');
const db = require('../../../connectors/db');
const bodyParser = require('body-parser');
const getUser = require('../../../routes/public/get_user');

module.exports = function (app) {
	app.use(bodyParser.json());
	app.use(bodyParser.urlencoded({ extended: true }));

	app.post('/api/v1/payment/subscription/ticket/', async function (req, res) {
		const user = await getUser(req);
		const userId = user.user_id;

		// Get the possible_routes_id from its table using the origin and destination
		const possibleRoute = await db
			.select('*')
			.from('all_possible_pathes')
			.where('origin', req.body.origin)
			.andWhere('destination', req.body.destination);

		if (isEmpty(possibleRoute)) {
			console.log(possibleRoute);
			return res.status(400).send([400, 'Could not get route from DB']);
		}

		const routeOrigin = possibleRoute[0].origin;
		const routeDestination = possibleRoute[0].destination;
		console.log(possibleRoute[0].destination);
		// ABOUT SUBcriiption buy ticket problem
		// check if he already has a ticket to that ride
		// check if hes subscribed. if yes then get insert into ticket then ride. then decrement number of rides from subscription

		const ticketExists = await db
			.select('*')
			.from('ticket')
			.innerJoin('ride', 'ticket.ticket_id', 'ride.ticket_id')
			.where('user_id', userId)
			.andWhere('origin', routeOrigin)
			.andWhere('destination', routeDestination)
			.andWhere('ride.status', 'IN', ['upcoming', 'in_progress'])
			.andWhere('ride.start_time', req.body.start_time);
		if (!isEmpty(ticketExists)) {
			return res.status(401).send([401, 'user already purchased a ticket to this ride']);
		}

		number_of_stations = possibleRoute[0].number_of_stations;
		let price = 100;
		let zone_id = 100;
		const zones = await db.select('*').from('zones');
		for (cur_zone of zones) {
			if (cur_zone.maximumstations >= number_of_stations) {
				price = Math.min(cur_zone.price, price);
				zone_id = Math.min(cur_zone.zone_id, zone_id);

				break;
			}
		}
		console.log(price);

		try {
			const subscription = await db
				.select('*')
				.from('subscriptions')
				.where('status', 'active')
				.andWhere('user_id', userId);
			console.log(subscription);
			if (isEmpty(subscription))
				return res.status(402).send([402, 'You are not subscribed to an active plan']);
			console.log(123);
			let avialbe_subscription = subscription[0].numberofusages;

			if (avialbe_subscription <= 0) {
				const updatedSubscription = await db('subscriptions')
					.update({ status: 'canceled' }) // Replace 'newStatus' with the desired value
					.where('user_id', userId);
				return res
					.status(403)
					.send([403, 'You have reached your subscription plan usage limit!']);
			}

			console.log(subscription[0].zone_id);
			console.log(zone_id);

			if (subscription[0].zone_id <= zone_id)
				return res
					.status(405)
					.send([405, 'Your subscription plan does not cover the zones of this ticket!']);
			let sub__id = subscription[0].sub_id;
			console.log(524);

			await db('subscriptions')
				.where('sub_id', sub__id)
				.update({ numberofusages: avialbe_subscription - 1 });

			const newTicket = {
				trans_id: null,
				status: 'active',
				user_id: userId,
				origin: routeOrigin,
				destination: routeDestination,
				sub_id: sub__id,
				zone_id: zone_id,
			};

			const newTicketEntry = await db('ticket').insert(newTicket).returning('*');

			const newRide = {
				status: 'upcoming',
				start_time: req.body.start_time,
				end_time: req.body.end_time,
				ticket_id: newTicketEntry[0].ticket_id,
			};

			const newRideEntry = await db('ride').insert(newRide).returning('*');

			return res
				.status(200)
				.send([200, 'Ticket successfully booked and ticket, Ride added to DB']);
		} catch (err) {
			console.log(err.message);
			return res.status(406).send([406, 'Error: Could not enter data into database']);
		}
	});
};

//zabat ena when usages finished--> set sub as canceled
