1.  Routing Pattern

- Create mode → /feature/create
- Edit mode → /feature/:entityId
- Both modes → SAME component, distinguish via ActivatedRoute
- Edit route → always has a Resolver attached
- On success → navigate to list page
- On cancel → routerLink back to list page

2.  Cleanup Pattern

- destroy$ = new Subject<void>() on every component
- All subscriptions use takeUntil(destroy$)
- ngOnDestroy always calls destroy$.next() + destroy$.complete()

3.  Service Pattern

- BehaviorSubject for each state: list, single entity, loading, pagination
- Expose as Observable via getter (get buses$, get bus$, get loading$)
- list() → sets loading true/false via finalize, pushes to BehaviorSubject
- getById() → fetches and pushes to bus$ via tap()
- create() / update() / delete() → plain HTTP, with BehaviorSubject side effects via tap()
- delete() → filter BehaviorSubject list locally after success via tap()
- posId always from localStorage.getItem('posId') inside the service
- Never pass posId from the component

4.  Component Pattern

- Always subscribe to service BehaviorSubject (entity$) in ngOnInit
- Always initialize the form INSIDE the BehaviorSubject subscription
  because it triggers whenever APIs are called
- Use take(1) on BehaviorSubject if you only need initial value
- Snapshot initialValues with getRawValue() AFTER form is populated
- Subscribe to valueChanges ONCE — outside or after form init with take(1) guard
- isButtonDisabled = true by default
- isButtonDisabled driven by isEqual(currentValues, initialValues)

5.  Form Pattern

- Always use ReactiveFormsModule with FormBuilder
- Nested objects → fb.group()
- Arrays → fb.array() with fb.group() per item if there is an array to handle
- Always use getRawValue() — never .value
  (.value excludes disabled controls)
- isInvalid(controlName) helper for inline error display
  → invalid && (dirty || touched)
- markAllAsTouched() on invalid submit attempt

6.  Submit Pattern

CREATE → send only FormHelper.getChangedValues(getRawValue(), initialValues) + target: { pos: posId }
EDIT → send only FormHelper.getChangedValues(getRawValue(), initialValues)
→ if changes is empty → return early, do nothing

isSubmitting = true on start
isSubmitting = false only on error (on success navigate away)

Success → alert.success() → navigate away
Error → parse err.error.message for known error codes
→ alert.error() with translated message
→ stay on page

7.  Change Detection Pattern

- isButtonDisabled = true by default
- After form init snapshot initialValues = getRawValue()
- busForm.valueChanges → isEqual(getRawValue(), initialValues)
- For fields outside the form (files, external state) →
  always move them INSIDE the form as FormArray or FormControl
  so getChangedValues catches them automatically
- Never use manual markFormDirty() workarounds
- Never track external arrays alongside the form

8.  Picture Upload Pattern

- Pictures always inside form as FormArray of fb.group({ baseUrl, path })
- Upload → push new fb.group to FormArray on S3 success
- Remove → removeAt(index) on FormArray + deleteFileFromAws(path)
- Never save pictures separately from submit umless it's edit mode
- Never call persistMediaChanges() outside submit
- S3 upload always uses posId from localStorage inside the component

9.  Resolver Pattern in Edit route (edit mode)

- Always use a Resolver for entity fetching before navigation
- Resolver calls service.getById() which pushes to BehaviorSubject via tap()
- Component reads from subscribes to entity$ not from route.snapshot.data
- Never fetch data inside the component on init
- Guarantees data is available before component loads

10. i18n Pattern

- No hardcoded strings anywhere in templates or components
- All text via TranslateService or translate pipe
- Error codes from backend mapped to i18n keys
- pageInfo.setTitle() always uses translate.instant()

11. Target / POS Pattern

- target: { pos } always injected from localStorage.getItem('posId')
- Never shown in any form
- Never passed from component to service
- Service injects it directly into HTTP params
- Always scoped — never query without posId

12. What Copilot Should Never Do

Use .value instead of getRawValue()
Fetch data inside ngOnInit directly — always use Resolver
Track pictures or any array outside the form — use FormArray
Call persistMediaChanges() in create mode
Hardcode any user-visible string — always use i18n
Pass posId from component to service methods
Send full payload on EDIT — always use FormHelper.getChangedValues
Re-subscribe to valueChanges multiple times — init once after form is built
Use manual isButtonDisabled = false workarounds — always use isEqual
Forget takeUntil(destroy$) on any subscription
