import { Schema, model } from "mongoose";

const counterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export const CounterModel = model("Counter", counterSchema);

export async function nextSequence(name: string): Promise<number> {
  const doc = await CounterModel.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc.seq;
}
