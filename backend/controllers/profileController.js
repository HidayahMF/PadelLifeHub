const { getJourney } = require('../services/journeyService');

const getJourneyData = async (req, res, next) => {
  try {
    res.json(await getJourney(req.user._id));
  } catch (err) {
    next(err);
  }
};

module.exports = { getJourneyData };
