const express = require('express');
const { protect } = require('../middleware/auth');
const { getProjects, createProject, updateProject, deleteProject } = require('../controllers/businessProjectController');

const router = express.Router();
router.use(protect);
router.get('/', getProjects);
router.post('/', createProject);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);
module.exports = router;
