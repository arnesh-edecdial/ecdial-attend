import { Router, Request, Response, NextFunction } from 'express';
import express from 'express';
import { authMiddleware } from '../middleware/auth';
import { serviceIntakeController as c } from '../controllers/serviceIntake.controller';

const router = Router();
const rawImage = express.raw({ type: 'image/*', limit: '12mb' });
const BLOCKED_ROLES = new Set(['HR', 'IT_ADMIN', 'IT']);

router.use(authMiddleware);

// Image delivery stays available to authenticated image requests so React Native
// can render stored photos. All Service Intake API actions are role protected.
router.get('/images/:filename', c.serveImage);

const serviceIntakeAccess = (req: Request, res: Response, next: NextFunction) => {
  const role = String((req as any).user?.role || '').toUpperCase();
  if (BLOCKED_ROLES.has(role)) return res.status(403).json({ success: false, message: 'Service Intake is not available for your role.' });
  next();
};
router.use(serviceIntakeAccess);

router.get('/options', c.getOptions);
router.get('/', c.listIntakes);
router.get('/:id', c.getIntake);
router.post('/', c.createIntake);
router.patch('/:id', c.updateIntake);
router.post('/:id/status', c.changeIntakeStatus);
router.post('/:id/archive', c.archiveIntake);
router.post('/:id/notes', c.addNote);
router.post('/:id/images', rawImage, c.uploadImage);
router.delete('/:id/images/:imageId', c.deleteImage);
router.post('/:id/items', c.addItem);
router.patch('/:id/items/:itemId', c.updateItem);
router.post('/:id/items/:itemId/status', c.changeItemStatus);
router.post('/:id/items/:itemId/responsible', c.changeItemResponsible);
router.post('/:id/items/:itemId/images', rawImage, c.uploadImage);

export default router;
