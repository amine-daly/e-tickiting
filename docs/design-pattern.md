1.  Routing Pattern

- Create mode → /feature/create
- Edit mode → /feature/:id ← not /feature/:id/edit
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
- Use take(1) ONLY if you need one-time fetch (e.g., initializing form when using resolver)
  For reactive updates (like after create/update), subscribe WITHOUT take(1)
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

6. Submit Pattern (Defensive)

CREATE → FormHelper.getChangedValues(getRawValue(), initialValues) + target: { pos: posId }
EDIT → FormHelper.getChangedValues(getRawValue(), initialValues)
→ Always check if changes is empty → return early, do nothing

isSubmitting = true on start
isSubmitting = false only on error (on success navigate away)

Success → alert.success() → navigate away
Error → parse err.error.message for known error codes
→ alert.error() with translated message
→ stay on page

## 7. Resolver Pattern

- Resolver is used ONLY on edit routes — never on list or create routes
- List page fetches data directly via service.list() in ngOnInit
- Create page needs no resolver — no existing entity to fetch
- Edit page always has a Resolver attached to guarantee data
  is available before the component loads

- Resolver calls service.getById(id) which pushes to entity$ via tap()
- Component subscribes to entity$ — NOT route.snapshot.data
- Never fetch data inside the component on init for edit mode

Route setup:
/feature/list → no resolver
/feature/create → no resolver
/feature/:id → Resolver attached ✅ 8. Picture Upload Pattern

- Pictures always inside form as FormArray of fb.group({ baseUrl, path })
- Upload → push new fb.group to FormArray on S3 success
- Remove → removeAt(index) on FormArray + deleteFileFromAws(path)
- Never save pictures separately from submit umless it's edit mode
- Never call persistMediaChanges() outside submit
- S3 upload always uses posId from localStorage inside the component

8. i18n Pattern

- No hardcoded strings anywhere in templates or components
- All text via TranslateService or translate pipe
- Error codes from backend mapped to i18n keys
- pageInfo.setTitle() always uses translate.instant()

9. Target / POS Pattern

- target: { pos } always injected from localStorage.getItem('posId')
- Never shown in any form
- Never passed from component to service
- Service injects it directly into HTTP params
- Always scoped — never query without posId

10. What Copilot Should Never Do

Use .value instead of getRawValue()
Fetch data inside ngOnInit directly — always use Resolver
Track pictures or any array outside the form — use FormArray
Call persistMediaChanges() in create mode
Hardcode any user-visible string — always use i18n
Pass posId from component to service methods

CREATE → FormHelper.getChangedValues(getRawValue(), initialValues) + target: { pos: posId }
EDIT → FormHelper.getChangedValues(getRawValue(), initialValues)
No need to check if changes is empty — isButtonDisabled already

prevents submit when nothing has changed.
Re-subscribe to valueChanges multiple times — init once after form is built
Use manual isButtonDisabled = false workarounds — always use isEqual
Forget takeUntil(destroy$) on any subscription

❌ Write manual utility functions when lodash/date-fns already has it
❌ Use raw Date arithmetic or string manipulation
❌ Implement custom deep equality, debounce, or array operations
❌ Write getters/setters manually — use Lombok @Data (Backend)
❌ Manual DTO mapping — use MapStruct (Backend)
❌ Manual null/empty checks — use Apache Commons (Backend)
❌ String concatenation for queries — use JPA Specifications (Backend)
❌ Manual validation logic — use Bean Validation annotations (Backend)

═══════════════════════════════════════════════════════════════

GOLDEN RULE: If you're writing more than 3 lines for a common operation,
there's probably a library function for it. USE IT.

Frontend: lodash + date-fns + rxjs
Backend: Apache Commons + Lombok + MapStruct + Bean Validation

═══════════════════════════════════════════════════════════════

11. LIBRARIES - ALWAYS USE UTILITIES (NEVER HARDCODE)
    CRITICAL: Always use battle-tested libraries to minimize code and maximize maintainability.

Frontend (Angular):
✅ lodash - Use for ALL data manipulation

- isEqual() for deep comparison
- isEmpty() for null/undefined/empty checks
- cloneDeep() for immutable copies
- groupBy(), \_.sortBy(), \_.uniqBy() for array operations
- debounce(), \_.throttle() for performance
- get(), \_.set() for safe nested access
  etc...

✅ date-fns - Use for ALL date operations

- format(), parse() for date formatting
- addDays(), subDays(), differenceInDays()
- isAfter(), isBefore(), isWithinInterval()
- startOfDay(), endOfMonth(), etc.
- NEVER use new Date() arithmetic or manual formatting
  -etc...

✅ rxjs - Use for ALL async operations

- map(), filter(), tap(), switchMap(), mergeMap()
- debounceTime(), distinctUntilChanged()
- combineLatest(), forkJoin(), merge()
- takeUntil(), take(), first()

Backend (Spring Boot):
✅ Apache Commons Lang3 - For string/object utilities

- StringUtils.isEmpty(), isBlank(), isNotEmpty()
- ObjectUtils.isEmpty(), defaultIfNull()
- StringUtils.join(), split(), capitalize()

✅ Apache Commons Collections4 - For collection operations

- CollectionUtils.isEmpty(), isNotEmpty()
- CollectionUtils.subtract(), intersection(), union()
- ListUtils.partition(), removeAll()

✅ Lombok - For boilerplate reduction

- @Data, @Builder, @NoArgsConstructor, @AllArgsConstructor
- @Slf4j for logging
- @RequiredArgsConstructor for dependency injection
- NEVER write getters/setters/constructors manually

✅ MapStruct - For DTO/Entity mapping

- NEVER manually map fields between DTOs and entities
- Use @Mapper interfaces for all conversions

✅ Bean Validation (JSR-380) - For validation

- @NotNull, @NotBlank, @Size, @Min, @Max
- @Valid for nested validation
- Custom validators with @Constraint
- NEVER write manual validation logic

✅ Spring Data JPA Specifications - For dynamic queries

- NEVER build query strings manually
- Use Specification<T> for complex filters

✅ Guava (Optional) - For advanced collections

- ImmutableList, ImmutableSet, ImmutableMap
- Multimap, BiMap, Table
- Use when Apache Commons is not enough

NEVER DO:
❌ Manual null checks when Apache Commons has it
❌ Manual getters/setters when Lombok can generate them
❌ Manual DTO mapping when MapStruct can do it
❌ String concatenation for queries (use JPA Criteria or Specifications)
❌ Manual validation logic (use Bean Validation annotations)
❌ Reinventing collection utilities (use Apache Commons)

Examples:

// ❌ BAD - Hardcoded (Frontend)
if (obj === null || obj === undefined || Object.keys(obj).length === 0) { }
const formatted = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
const unique = arr.filter((v, i, a) => a.indexOf(v) === i);

// ✅ GOOD - Using libraries (Frontend)
if (_.isEmpty(obj)) { }
const formatted = format(date, 'yyyy-MM-dd');
const unique = _.uniqBy(arr, 'id');

// ❌ BAD - Hardcoded (Backend)
if (str == null || str.trim().isEmpty()) { }
List<BusDTO> dtos = new ArrayList<>();
for (Bus bus : buses) {
BusDTO dto = new BusDTO();
dto.setId(bus.getId());
dto.setName(bus.getName());
// ... 20 more lines
dtos.add(dto);
}

// ✅ GOOD - Using libraries (Backend)
if (StringUtils.isBlank(str)) { }
List<BusDTO> dtos = busMapper.toDtoList(buses); // MapStruct

═══════════════════════════════════════════════════════════════
