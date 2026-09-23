const BusinessProject = require('../models/BusinessProject');
const Transaction = require('../models/Transaction');

function dateValue(value, fallback = new Date()) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const error = new Error('Invalid project date');
    error.statusCode = 400;
    throw error;
  }
  return date;
}

function projectStats(project, rows) {
  const income = rows.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
  const expense = rows.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0);
  return { ...project, totalIncome: income, totalExpense: expense, profitLoss: income - expense };
}

const getProjects = async (req, res, next) => {
  try {
    const projects = await BusinessProject.find({ user: req.user._id }).sort({ createdAt: -1 }).lean();
    const transactions = await Transaction.find({ user: req.user._id, financeScope: 'business', businessProject: { $ne: null } }).lean();
    const byProject = new Map();
    for (const tx of transactions) {
      const key = String(tx.businessProject);
      if (!byProject.has(key)) byProject.set(key, []);
      byProject.get(key).push(tx);
    }
    res.json(projects.map((project) => projectStats(project, byProject.get(String(project._id)) || [])));
  } catch (error) { next(error); }
};

const createProject = async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) { const error = new Error('Project name is required'); error.statusCode = 400; throw error; }
    const project = await BusinessProject.create({
      user: req.user._id,
      name,
      description: String(req.body.description || '').trim(),
      startDate: dateValue(req.body.startDate),
      endDate: req.body.endDate ? dateValue(req.body.endDate, null) : null,
      status: req.body.status || 'active',
    });
    res.status(201).json(projectStats(project.toObject(), []));
  } catch (error) { next(error); }
};

const updateProject = async (req, res, next) => {
  try {
    const project = await BusinessProject.findOne({ _id: req.params.id, user: req.user._id });
    if (!project) { res.status(404); throw new Error('Project not found'); }
    for (const field of ['name', 'description', 'status']) if (req.body[field] !== undefined) project[field] = field === 'name' || field === 'description' ? String(req.body[field]).trim() : req.body[field];
    if (req.body.startDate !== undefined) project.startDate = dateValue(req.body.startDate);
    if (req.body.endDate !== undefined) project.endDate = req.body.endDate ? dateValue(req.body.endDate, null) : null;
    const saved = await project.save();
    const transactions = await Transaction.find({ user: req.user._id, businessProject: saved._id }).lean();
    res.json(projectStats(saved.toObject(), transactions));
  } catch (error) { next(error); }
};

const deleteProject = async (req, res, next) => {
  try {
    const project = await BusinessProject.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!project) { res.status(404); throw new Error('Project not found'); }
    // Preserve transaction history; unlink rather than deleting financial data.
    await Transaction.updateMany({ user: req.user._id, businessProject: project._id }, { $set: { businessProject: null } });
    res.json({ message: 'Project removed' });
  } catch (error) { next(error); }
};

module.exports = { getProjects, createProject, updateProject, deleteProject };
