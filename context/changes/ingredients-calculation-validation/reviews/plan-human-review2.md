# Plan review

## Phase 1

`ingredient_type` enum should live in application level. No need to have it at db level, if it's unused there

## General thoughts

Once we consolidated calculation and validation approaches to be executed client-side and we agreed upon ingredients scheme. Let's get back to discussion about server-side vs client-side.
I still prefer server-side as a single point of thruth and future proof - more client's mean all these needs to be duplicated (i.e. mobile app in a future).
The issue is that we want to use live data for these. Any well established patterns for that? Maybe current approach is correct, and exported library can be easily imported by iOS and androind apps, even for offline support? On the other hand - bug in caluclation couldn't be fixed server side. Users might need to install newer version of application.

Don't agree to my statements, follow established patterns and best practices to solve it for production system, not user asking questions
