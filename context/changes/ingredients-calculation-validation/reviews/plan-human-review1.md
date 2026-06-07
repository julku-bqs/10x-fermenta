# Plan review

Below are points for discussion or concerns related to plan ingredients-calculation-validation

## General thoughts

Don't take current plan as grounded in stone. If some findings are hard to fix with currently planned architecture, the architecture could be revised. It's still early stage of the project, so architecture could still be adjusted.

### Database

Plan spotted that `ingredient` table has `unit` column. During planning we discussed that the unit is 'L' (liters). It's inconsistent from initial view. Plan should include a migration that removes the unit column, and optionally change `amount` to say clearly the unit (i.e. 'amount_liters', 'amount_l', or simply 'liters').

Additionally, sugar (which is ingredient) should be expressed in kilograms to preserve a unit (1L = 1kg). For values other than whole kilograms, fractions could be used (1,2 = 1200g)

### Sugar calculation

1. Plan should include information about sugar calculation button placement. In my opinion it should be somewhere close to the sugar entries. There might be 2 fields for sugar (fermentation and sweetness) - Calculate button should be one - for both

2. Second sugar ingredient (for sweetness) should be added only if user selected non-dry wine. Consider edge cases (user changed batch from dry to non-dry -> sweetness sugar added -> user cancelled edit -> sweetness sugar shouldn't be assigned to batch)

3. Both sugars should always appear at the top of the list (but below yeast). They could leverage sort_order (fermentation = -2; sweetness = -1)

4. I can see potential pitfall we need to avoid: Calculation input shouldn't be taken from current DB state, but form current form state (user might not yet save the batch to update parameters)

5. `fermentation_sugar = max(0, sugar_needed_for_abv - total_ingredient_sugar)` - this is true, but this is also a crtitical point to understand, because it has significatn edge-cases:
Assume `sugar_needed_for_abv - total_ingredient_sugar` is negative. This might produce a warning, but it also might be expected to achieve target sweetness from residual sugar, even without adding sweetness sugar (or adding less than if we had no ingredient_sugar).
To give more correct calculation, probably yeast_tolerance should be taken into consideration as optional input parameter (if no yeast tolerance provided, we don't know how much abv we could achive, so we assume target_abv could always be achieved. This is basically equal to yest_tolerance = 100%).
Now assume the input contains yeast_tolerance. If `sugar_needed_for_abv - total_ingredient_sugar` is negative and yeast_tolerance is higher than target_abv (or not provided = 100%), target_abv is unreachable, it would be higher, up to yeast_tolerance. This is one of the validation rules we need to apply, and it's found in this calculation. We should either return a warning from here, or return corrected target_abv, to delegate validation rule apply to the caller (input.target_abv == output.target_abv). Calculate API endpoint should apply validation rules and return the warning to UI for display. **OR** the result should be inspected in UI to put a warning (more consistent with other validation done currently in frontend layer - unless it's changed). On the other hand, pahse 3 addresses it in a different place, so maybe this part could not care about it

### Yeast

Yeast ingredient is optional. If there is no yeast in a batch, user should see a button to add yeast, instead of a form. If yeast is not added, application should assume no added yeast (skip yeast validation rules, but put a warning that using wild yeast can give unpredictable results)

### Batch parameters

Don't assume any value. I.e. if user didn't provide target ABV - don't put warnigns related to ABV, instead one warning is enough - no target ABV, results might be unpredictable

## Desired End State

4. User can edit or remove any ingredient, but not sugar. Existance of sugar ingredients should be derieved from parameters (fermentation sugar is always added, if no added sugar needed, it should have simply 0 amount; sweetness sugar is added only for non-dry wines). Anyway sugar should have no visual distintion from other ingredients

## Ingredients CRUD

I'm considering the expected behavior after adding some ingredients and then cancelling a batch (without saving). Current approach will persist ingredients even though cancelling other batch parameter changing.
It might be ok and accepted, however user could expect, that cancelling changes should also forget added ingredients and leave the state as it was never modified.
On the other hand, deffering ingredients save, might conflict with other concerns in this review - ingredients takes part in both sugar calculation and validation rules. If validation rules were moved to backend (other concern from this document), they probably need current 'ive' batch/ingredient state, instead of current DB state. And same for sugar caluclation. For client-level validation it probably is fine due ingredients are already in place.

## Validation engine

I'm still considering what should be the correct place to put validation rules. UI gives convenience, but backend seems to be a better place for it. THese are domain critical validations and core of the project. Can we revise or discuss more one approach or another?


## UI Components

1. As mentioned above, ingredients unit is always Liters (except sugar, what is kilograms). No need to make a form for unit. It shouldn't exist.
2. Warnings banner - since it shows all validation warnings, it should be well designed to provide informative and helpful information, but not being overwhelming and distractful. It should not bother user

## Final thoughts

We put away ingredients unit. It should be good simplicifaction, but on the other hand, user might want to add some ingredients (without fermentation sugar) which are i.e. spices (liters are wrong here), which might need other unit (grams, spoons, etc.). I'm considering whether we should plan unit concept anyway, or go with the simplification. Potentially, we can add it to v2 and even model it differently, i.e. by a separate table for 'additional_ingredients' - with no sugar_content, but definable unit instead, for pure informative purpose (like in recipe). Separate schema, separate table, visually the same component, but placed below current ingredients table