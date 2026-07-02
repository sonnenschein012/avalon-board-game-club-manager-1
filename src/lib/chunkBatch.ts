import { writeBatch, Firestore, DocumentReference, UpdateData, WithFieldValue, DocumentData } from 'firebase/firestore';

export async function commitBatchesInChunks(
  db: Firestore,
  operations: Array<{
    type: 'set' | 'update' | 'delete';
    ref: DocumentReference;
    data?: any;
  }>,
  chunkSize: number = 400
) {
  for (let i = 0; i < operations.length; i += chunkSize) {
    const chunk = operations.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    
    for (const op of chunk) {
      if (op.type === 'set' && op.data) {
        batch.set(op.ref, op.data);
      } else if (op.type === 'update' && op.data) {
        batch.update(op.ref, op.data);
      } else if (op.type === 'delete') {
        batch.delete(op.ref);
      }
    }
    
    await batch.commit();
  }
}
