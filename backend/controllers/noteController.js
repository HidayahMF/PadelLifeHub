const Note = require('../models/Note');

const getNotes = async (req, res, next) => {
  try {
    const { search, archived, trashed, tag } = req.query;
    const filter = { user: req.user._id };

    if (trashed !== undefined) filter.trashed = trashed === 'true';
    else filter.trashed = { $ne: true };
    // Archived items stay out of the default (active) list.
    if (archived !== undefined) filter.archived = archived === 'true';
    else filter.archived = { $ne: true };
    if (tag) filter.tags = tag;

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
      ];
    }

    const notes = await Note.find(filter).sort({ pinned: -1, updatedAt: -1 });
    res.json(notes);
  } catch (err) {
    next(err);
  }
};

const getNoteById = async (req, res, next) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, user: req.user._id });
    if (!note) {
      res.status(404);
      throw new Error('Note not found');
    }
    res.json(note);
  } catch (err) {
    next(err);
  }
};

const createNote = async (req, res, next) => {
  try {
    const note = await Note.create({
      user: req.user._id,
      ...req.body,
    });
    res.status(201).json(note);
  } catch (err) {
    next(err);
  }
};

const updateNote = async (req, res, next) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, user: req.user._id });
    if (!note) {
      res.status(404);
      throw new Error('Note not found');
    }
    Object.assign(note, req.body);
    const updated = await note.save();
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

const deleteNote = async (req, res, next) => {
  try {
    const note = await Note.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!note) {
      res.status(404);
      throw new Error('Note not found');
    }
    res.json({ message: 'Note removed' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getNotes, getNoteById, createNote, updateNote, deleteNote };
