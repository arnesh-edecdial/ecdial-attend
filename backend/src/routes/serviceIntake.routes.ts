import { Router } from 'express';
import express from 'express';
import { authMiddleware } from '../middleware/auth'; // NOTE: confirm this is the project's actual auth middleware export before wiring up
import { serviceIntakeController as c } from '../controllers/serviceIntake.controller';

const router = Router();
const rawImage = express.raw({ type: 'image/*', limit: '12mb' });

router.use(authMiddleware);

router.get('/options', c.getOptions);
router.get('/', c.listIntakes);
router.get('/images/:filename', c.serveImage);
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
// Mount in server.ts as: app.use('/api/service-intakes', serviceIntakeRoutes)
// (matches the existing mobileApi.getServiceImageUrl() base path)