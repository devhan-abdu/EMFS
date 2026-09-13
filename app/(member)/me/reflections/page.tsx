"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

// Local UI Placeholders
const sampleReflections = [
  {
    id: "1",
    week: 4,
    book: "The Sealed Nectar",
    submittedOn: "Last Friday",
    excerpt:
      "Reading about the early hardship in Makkah gave me a fresh perspective on patience in my daily life.",
    mine: true,
  },
  {
    id: "2",
    week: 5,
    book: "The Sealed Nectar",
    author: "Fatima S.",
    submittedOn: "Yesterday",
    excerpt:
      "The unity among the Sahabah during the migration to Madinah stood out to me most this week.",
    mine: false,
  },
  {
    id: "3",
    week: 5,
    book: "The Sealed Nectar",
    author: "Aisha M.",
    submittedOn: "2 days ago",
    excerpt:
      "Taking it slow at 5 pages a day helps me absorb the emotional depth of each event.",
    mine: false,
  },
];

export default function ReflectionsPage() {
  const [text, setText] = useState("");
  const mine = sampleReflections.filter((r) => r.mine);
  const others = sampleReflections.filter((r) => !r.mine);

  return (
    <div className="space-y-8">
      <div className="rise-in space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal">
          Week 5
        </p>
        <h1 className="font-display text-3xl font-semibold text-foreground md:text-[2.5rem] md:leading-tight">
          Reflections
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          What did this week's pages leave with you? Write plainly — your pace
          group admin reads it, and your sisters can see it too.
        </p>
      </div>

      <Card className="card-soft">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-xl">
            This week's reflection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            placeholder="The pages on Badr made me think about…"
            className="resize-none bg-surface-2"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {text.trim().split(/\s+/).filter(Boolean).length} words · due
              Friday
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => toast("Draft saved")}>
                Save draft
              </Button>
              <Button
                disabled={text.trim().length === 0}
                onClick={() => {
                  toast.success("Reflection submitted");
                  setText("");
                }}
              >
                Submit
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          Your past reflections
        </h2>
        <div className="space-y-4">
          {mine.map((r) => (
            <Card key={r.id} className="card-soft">
              <CardContent className="space-y-2 p-6">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-teal/15 px-2.5 py-0.5 font-medium text-teal-foreground">
                    Week {r.week}
                  </span>
                  <span>
                    {r.book} · {r.submittedOn}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-foreground">
                  {r.excerpt}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-foreground">
          From your pace group
        </h2>
        <div className="space-y-4">
          {others.map((r) => (
            <Card key={r.id} className="card-soft bg-surface-2">
              <CardContent className="space-y-2 p-6">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {r.author}
                  </span>
                  <span>
                    Week {r.week} · {r.submittedOn}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-foreground">
                  {r.excerpt}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
