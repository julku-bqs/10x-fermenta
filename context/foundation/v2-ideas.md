# Fermenta - ideas for v2

## Better calculations

Sugar in a must has different density than water. Sugar content in a must/juice meadured in either %/Blg/Brix is basing on weight - 1L != 1kg.
Idea is to take that into calculations utilising a formula to calculate existing sugar better (ingredient volume and measurement conversion to all existing fermentation sugar)

→ Change: `sugar-calculation-improvements`

### Initial measurement

In addition to providing sugar content in each ingredient, introduce initial density (Blg/Brix?) measurement.
It can be estimated from all ingredients before batch is set and updated by real user measurement afterwards.

## Reference tables

Reference table for known fruit sugar content (i.e. grapes 20-25%)

## App UX

### Localisation

Utilise well established framework to localise the application. Initially EN and PL languages could be supported.
Pay attention to reference tables ingredients names - they should also be localised.

### Batch actions improvements

Batch list elements could have set of action buttons - i.e. delete and duplicate

### Additional measurements

Each diary entry could be amended with measurements - name of measurement, unit, value, optioanlly a quick note. Displayed and added under some expandable UI element

### Regenerate plan dirty guard

Disable "Regenerate Plan" button when batch form has unsaved changes. Tooltip informs user to save first — regeneration uses persisted state, not dirty form values.

→ Change: `regenerate-dirty-guard`

## More ideas

Update that document with more ideas not critical to the project, but nice to have in version 2.
Add v3-ideas once v2 scope is commited and new features are expected to be delivered in further phases (i.e. more social features like batch sharing, prublic/private batches with a feed of users public batches etc.)