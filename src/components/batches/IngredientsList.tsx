interface IngredientsListProps {
  yeastName: string | null;
  yeastTolerance: number | null;
}

export function IngredientsList({ yeastName, yeastTolerance }: IngredientsListProps) {
  const hasYeast = yeastName && yeastName.trim().length > 0;

  return (
    <div className="border-border mt-4 border-t pt-4">
      <h3 className="text-muted-foreground mb-2 text-sm font-medium">Added Ingredients</h3>
      {hasYeast ? (
        <ul className="space-y-2">
          <li className="bg-card flex items-center justify-between rounded-md px-3 py-2 text-sm">
            <span className="text-foreground font-medium">🧪 {yeastName}</span>
            {yeastTolerance != null && <span className="text-muted-foreground">{yeastTolerance}% tolerance</span>}
          </li>
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm italic">No ingredients added yet</p>
      )}
      <p className="text-muted-foreground mt-3 text-xs">More ingredients — coming soon</p>
    </div>
  );
}
