import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { RouterLink, RouterModule } from '@angular/router';
import {
  endOfToday,
  format,
  startOfToday,
  subDays,
  subMonths,
  subWeeks,
  subYears,
} from 'date-fns';
import { NgApexchartsModule } from 'ng-apexcharts';
import { CarouselModule, OwlOptions } from 'ngx-owl-carousel-o';
import { NgSelectModule } from '@ng-select/ng-select';
import Swal from 'sweetalert2';
import { DOCUMENT } from '@angular/common';
import {
  NgbDropdownModule,
  NgbModal,
  NgbNavModule,
} from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { ChangeDetectorRef, Component, OnInit, Inject } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  difference,
  filter,
  find,
  isEqual,
  map,
  omit,
  reverse,
  some,
  times,
  values,
  without,
} from 'lodash';
import {
  of,
  take,
  Subject,
  forkJoin,
  switchMap,
  takeUntil,
  catchError,
  Observable,
  debounceTime,
  Subscription,
  map as rxMap,
  combineLatest,
  BehaviorSubject,
  distinctUntilChanged,
} from 'rxjs';

import { IPagination } from '@diktup/frontend/models';
import { AmazonS3Helper, StorageHelper } from '@diktup/frontend/helpers';

import { FormHelper } from '@sifca-monorepo/clients';
import {
  UserRole,
  UserType,
  TotalType,
  WalletType,
  AccountType,
  DashboardEnum,
  PermissionType,
  PointOfSaleType,
  MobileThemesEnum,
  DateValueChartType,
  DeleteFileFromAwsGQL,
  ActiveQuestsStatsType,
  CorporateUserDashType,
  GenerateS3SignedUrlGQL,
  PermissionDefinitionType,
  PermissionPermissionsType,
  WalletTransactionsStatsType,
  GamificationGetCorporateUsersStatsDashboardType,
  GamificationEngagmentProgressionOverTimeDashboardType,
} from '@sifca-monorepo/terminal-generator';

import { featuredData } from './data';
import { IndexService } from './index.service';
import { BitcoinChart } from '../engagement/wallet/data';
import { TeamService } from '../system/team/team.service';
import { AuthService } from '../../core/auth/auth.service';
import { KycService } from '../dashboards/kyc/kyc.service';
import { PosService } from '../../core/services/pos.service';
import { RolesService } from '../system/roles/roles.service';
import { UserService } from '../../core/services/user.service';
import { CompanyService } from '../system/company/company.service';
import { AWS_CREDENTIALS } from '../../../environments/environment';
import { SharedService } from '../../shared/services/shared.service';
import { WalletService } from '../engagement/wallet/wallet.service';
import { LoyaltyService } from '../system/apps/apps/loyalty/loyalty.service';
import { CombinedTransactionAndEvent } from '../engagement/wallet/transactions-events';
import { EngagementService } from '../dashboards/engagement/engagement.service';

import { BreadcrumbsComponent } from '../../shared/breadcrumbs/breadcrumbs.component';
import { CustomCurrencyPipe } from '../../shared/pipes/currency.pipe';
import { NumberWithSuffixPipe } from '../../shared/pipes/number-with-suffix.pipe';
import { UserDistributionComponent } from '../../shared/components/user-distribution/user-distribution.component';
import { AnalaticsStatComponent } from '../../shared/widget/analytics/analatics-stat/analatics-stat.component';
import { TransactionsComponent } from '../../shared/components/transactions/transactions.component';
import { CampaignsService } from '../engagement/campaigns/campaign/campaigns.service';
import { DashboardCampaignsService } from '../dashboards/campaigns/dashbord-campaigns.service';

@Component({
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    CommonModule,
    NgbNavModule,
    RouterModule,
    TranslatePipe,
    NgSelectModule,
    CarouselModule,
    DragDropModule,
    NgbDropdownModule,
    CustomCurrencyPipe,
    NgApexchartsModule,
    ReactiveFormsModule,
    NumberWithSuffixPipe,
    BreadcrumbsComponent,
    TransactionsComponent,
    AnalaticsStatComponent,
    UserDistributionComponent,
  ],
  selector: 'app-analytics',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss'],
})
export class IndexComponent implements OnInit {
  private subscription: Subscription;
  private unsubscribeAll: Subject<any> = new Subject<any>();
  private pagination: BehaviorSubject<IPagination> =
    new BehaviorSubject<IPagination>(null);

  itemPage = 0;
  activeId = 1;
  pageLimit = 5;
  activeTab = 1;
  statData!: any;
  userId: string;
  initValue: any;
  startDate: Date;
  usersData: any[];
  searchValue = '';
  isAdmin: boolean;
  selectedPos: any;
  currency: string;
  BitcoinChart: any;
  allTargets: any[];
  displayRoles: any;
  basicBarChart: any;
  initialValues: any;
  isBrowser: boolean;
  cumulativeChart: any;
  featuredData!: any[];
  lastMonths: string[];
  searchedItems: any[];
  pageChanged: boolean;
  campaignsChart: any;
  saveSuccess: boolean;
  rolesForm: FormGroup;
  isAllChecked = false;
  endOfYesterday: Date;
  basicColumnChart: any;
  simpleDonutChart: any;
  selectedPosId: string;
  walletGraphChart: any;
  wallets: WalletType[];
  activeUsersChart: any;
  noActiveData: boolean;
  selectedUser: UserType;
  basicHeatmapChart: any;
  filteredTargets: any[];
  nonCumulativeChart: any;
  accounts: AccountType[];
  isButtonDisabled = true;
  theme: MobileThemesEnum;
  selectedWalletIndex = 0;
  dashboardForm: FormGroup;
  paginations: IPagination;
  createPosForm: FormGroup;
  loadingCreatePos: boolean;
  posList: PointOfSaleType[];
  isCreatePermission = false;
  isPosButtonDisabled = true;
  selectedWallet: WalletType;
  breadCrumbItems!: Array<{}>;
  assignTargetForm: FormGroup;
  isRoleButtonDisabled = true;
  userAccounts: AccountType[];
  selectedAccount: AccountType;
  isSearchButtonDisabled = true;
  permissions: PermissionType[];
  hasCheckedRecursively = false;
  cumulative: DateValueChartType;
  isTargetButtonDisabled: boolean;
  originalAccounts: AccountType[];
  walletChart: DateValueChartType;
  selectedUserAccount: AccountType;
  baseUrl = window.location.origin;
  nonCumulative: DateValueChartType;
  dashTypes = values(DashboardEnum);
  currentPermission: PermissionType;
  selectedPermission: PermissionType;
  dashboards: CorporateUserDashType[];
  filteredDashboards: DashboardEnum[];
  activeQuests: ActiveQuestsStatsType;
  selectedUserPermission: PermissionType;
  definitions: PermissionDefinitionType[];
  screenWidth: number = window.innerWidth;
  selectedDashboard: CorporateUserDashType;
  progressionYear = new Date().getFullYear();
  originalDefinitions: PermissionDefinitionType[];
  searchInputControl: FormControl = new FormControl();
  users$: Observable<UserType[]> = this.teamService.users$;
  posSearchInput$: Subject<string> = new Subject<string>();
  userSearchInput$: Subject<string> = new Subject<string>();
  usersSearchInput$: Subject<string> = new Subject<string>();
  usersStats: GamificationGetCorporateUsersStatsDashboardType;
  accountsSearchInput$: Subject<string> = new Subject<string>();
  wallet$: Observable<WalletType[]> = this.loyaltyService.wallet$;
  navigating$: Observable<boolean> = this.sharedService.navigating$;
  activeUsers: GamificationEngagmentProgressionOverTimeDashboardType;
  loadingUsers$: Observable<boolean> = this.teamService.loadingUsers$;
  userWallet$: Observable<TotalType> = this.walletService.userWallet$;
  loadingItems$: Observable<boolean> = this.indexService.loadingItems$;
  loadingEvents$: Observable<boolean> = this.kycService.loadingEvents$;
  loadingStats$: Observable<boolean> = this.walletService.loadingStats$;
  searchForm: FormGroup = this.formBuilder.group({ searchString: [''] });
  permissions$: Observable<PermissionType[]> = this.rolesService.permissions$;
  stats$: Observable<WalletTransactionsStatsType> = this.walletService.stats$;
  loadingTargets$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(
    null,
  );
  loadingUsersStats$: Observable<boolean> =
    this.indexService.loadingUsersStats$;
  loadingPermissions$: Observable<boolean> =
    this.rolesService.loadingPermissions$;
  loadingActiveQuests$: Observable<boolean> =
    this.indexService.loadingActiveQuests$;
  activeQuests$: Observable<ActiveQuestsStatsType> =
    this.indexService.activeQuests$;
  loadingTransactions$: Observable<boolean> =
    this.walletService.loadingTransactions$;
  loadingCorporateDashboard$: Observable<boolean> =
    this.indexService.loadingCorporateDashboard$;
  transactions$: Observable<CombinedTransactionAndEvent[]> =
    this.walletService.infiniteTransactions$;
  usersStats$: Observable<GamificationGetCorporateUsersStatsDashboardType> =
    this.indexService.usersStats$;

  filter = {
    from: subYears(startOfToday(), 20),
    to: endOfToday(),
  };
  Responsive = {
    infinite: true,
    slidesToShow: 3,
    autoplay: true,
    dots: false,
    arrows: false,
  };
  config = {
    touchStartPreventDefault: false,
    slidesPerView: 1,
    spaceBetween: 25,
    breakpoints: {
      768: {
        slidesPerView: 2,
      },
      1200: {
        slidesPerView: 3,
      },
      1599: {
        slidesPerView: 4,
      },
    },
  };

  dashboardsLinks = {
    KYC: '/dashboard/kyc',
    CRM: '/dashboard/crm',
    SALES: '/dashboard/sales',
    ANALYTICS: '/dashboard/analytics',
    ECOMMERCE: '/dashboard/ecommerce',
    ENGAGEMENT: '/dashboard/engagement',
    CAMPAIGNS: '/dashboard/campaigns',
    COLLABORATION: '/dashboard/collaboration',
  };
  dashboardIcons = {
    KYC: 'https://cdn.lordicon.com/fqbvgezn.json',
    CRM: 'https://cdn.lordicon.com/piwupaqb.json',
    SALES: 'https://cdn.lordicon.com/ofdfurqa.json',
    ANALYTICS: 'https://cdn.lordicon.com/abwrkdvl.json',
    ENGAGEMENT: 'https://cdn.lordicon.com/vttzorhw.json',
    CAMPAIGNS: 'https://cdn.lordicon.com/fozsorqm.json',
    COLLABORATION: 'https://cdn.lordicon.com/rdfmytjv.json',
  };

  owlOptions: OwlOptions = {
    loop: false,
    margin: 10,
    nav: false,
    dots: false,
    items: 1,
  };
  dashboardPermission: boolean;
  EngDashboardPermission: boolean;
  KycDashboardPermission: boolean;
  EcomDashboardPermission: boolean;
  totalCampaignsData: GamificationEngagmentProgressionOverTimeDashboardType;
  selectedTargetAccount: AccountType;

  get permissionsArray() {
    return this.rolesForm.get('permissions') as FormArray;
  }
  get pagination$(): Observable<IPagination> {
    return this.pagination.asObservable();
  }
  set pagination$(value: any) {
    this.pagination.next(value);
  }
  get primaryColor(): string {
    return this.sharedService.primaryColor;
  }
  get secondaryColor(): string {
    return this.sharedService.secondaryColor;
  }
  get picture() {
    return this.createPosForm.get(['pos', 'picture']);
  }

  constructor(
    private modalService: NgbModal,
    private posService: PosService,
    private kycService: KycService,
    private userService: UserService,
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private teamService: TeamService,
    private rolesService: RolesService,
    private indexService: IndexService,
    private translate: TranslateService,
    private walletService: WalletService,
    private sharedService: SharedService,
    private storageHelper: StorageHelper,
    private loyaltyService: LoyaltyService,
    private companyService: CompanyService,
    private amazonS3Helper: AmazonS3Helper,
    private campaignsService: CampaignsService,
    private changeDetectorRef: ChangeDetectorRef,
    @Inject(DOCUMENT) private document: Document,
    private engagementService: EngagementService,
    private deleteFileFromAwsGQL: DeleteFileFromAwsGQL,
    private generateS3SignedUrlGQL: GenerateS3SignedUrlGQL,
    private dashboardCampaignsService: DashboardCampaignsService,
  ) {
    this.endOfYesterday = subDays(endOfToday(), 1);
    this.startDate = subDays(this.endOfYesterday, 7);
    combineLatest([
      this.loyaltyService.wallet$,
      this.walletService.walletChart$,
    ])
      .pipe(takeUntil(this.unsubscribeAll))
      .subscribe(([wallet, walletChart]) => {
        this.wallets = wallet;
        this.selectedWallet = wallet?.[this.selectedWalletIndex];
        this.walletChart = walletChart;
        if (walletChart && wallet?.length) {
          this.currency = this.selectedWallet?.coin?.unitValue?.currency?.name;
          this.walletGraph(walletChart);
          this.changeDetectorRef.markForCheck();
        }
      });
    combineLatest([
      this.loyaltyService.quantitativeWalletsByOwnerPagination(),
      this.walletService.getWalletTransactionsStatsByAffected(),
      this.dashboardCampaignsService.getQuestDashboardChartData(
        new Date().getFullYear(),
      ),
      this.walletService.getAffectedTransactionsPaginated({
        from: subWeeks(endOfToday(), 1),
        to: endOfToday(),
        affected: [{ pos: this.storageHelper.getData('posId') }],
      }),
    ])
      .pipe(
        switchMap(([res]) => {
          const selectedWalletId = res?.[0]?.id;
          if (selectedWalletId) {
            return this.walletService.getWalletTransactionsStatsChartWithFilter(
              {
                from: this.startDate,
                to: this.endOfYesterday,
                wallet: selectedWalletId,
              } as any,
            );
          }
          return of(null);
        }),
        catchError(() => {
          this.walletService.loadingWalletChart$ = false;
          this.changeDetectorRef.markForCheck();
          return of(null);
        }),
      )
      .subscribe((res) => {
        if (res) {
          this.walletService.loadingWalletChart$ = false;
          this.changeDetectorRef.markForCheck();
        }
      });

    this.indexService.getUserDistributionsByLevel().subscribe();
    this.calculateLast4Months();
    this.BitcoinChart = BitcoinChart;
    this.searchForm.valueChanges
      .pipe(
        takeUntil(this.unsubscribeAll),
        debounceTime(500),
        distinctUntilChanged(),
        switchMap((searchValues) => {
          this.isSearchButtonDisabled = false;
          this.searchValue = searchValues?.searchString;
          this.changeDetectorRef.markForCheck();
          return of(null);
        }),
      )
      .subscribe();
    this.indexService.loadingItems$ = true;
  }

  ngOnInit(): void {
    this.translate.get('MENUITEMS.TS.HOME').subscribe((home: string) => {
      this.breadCrumbItems = [
        { label: 'Elevok' },
        { label: home, active: true },
      ];
    });

    this.searchInputControl.valueChanges
      .pipe(
        takeUntil(this.unsubscribeAll),
        debounceTime(500),
        distinctUntilChanged(),
        switchMap((searchString) => {
          this.filterRoles(searchString);
          return of(this.accounts);
        }),
      )
      .subscribe(() => {
        this.changeDetectorRef.markForCheck();
      });

    this.accountsSearchInput$
      .pipe(
        takeUntil(this.unsubscribeAll),
        debounceTime(500),
        distinctUntilChanged(),
        switchMap((searchString) => {
          this.filterAccounts(searchString);
          return of(this.accounts);
        }),
      )
      .subscribe(() => {
        this.changeDetectorRef.markForCheck();
      });

    this.usersSearchInput$
      .pipe(
        takeUntil(this.unsubscribeAll),
        debounceTime(500),
        distinctUntilChanged(),
        switchMap((searchString) => {
          this.teamService.page = 0;
          this.teamService.infiniteUsers$ = null;
          this.teamService.searchString = searchString ? searchString : '';
          return this.teamService.searchAccount();
        }),
      )
      .subscribe(() => this.changeDetectorRef.markForCheck());

    this.userSearchInput$
      .pipe(
        takeUntil(this.unsubscribeAll),
        debounceTime(500),
        distinctUntilChanged(),
        switchMap((searchString) => {
          this.teamService.usersPageIndex = 0;
          this.teamService.users$ = null;
          return this.teamService.searchUser(searchString || '');
        }),
      )
      .subscribe(() => this.changeDetectorRef.markForCheck());

    this.posSearchInput$
      .pipe(
        takeUntil(this.unsubscribeAll),
        debounceTime(500),
        distinctUntilChanged(),
        switchMap((searchString) => {
          this.indexService.posPageIndex = 0;
          this.indexService.targets$ = null;
          this.indexService.posSearchString = searchString ? searchString : '';
          return this.indexService.searchPos();
        }),
      )
      .subscribe(() => this.changeDetectorRef.markForCheck());

    combineLatest([this.posService.pos$, this.authService.accounts$])
      .pipe(
        takeUntil(this.unsubscribeAll),
        rxMap(([pos, accounts]) => {
          this.selectedAccount = find(
            accounts,
            (account: AccountType) => account?.target?.pos?.id === pos?.id,
          );
          return filter(
            this.selectedAccount?.permission?.permissions,
            (perm: PermissionPermissionsType) =>
              perm?.read || perm.update || perm.create,
          );
        }),
      )
      .subscribe((filteredPermissions) => {
        this.dashboardPermission = !!filteredPermissions.find(
          (perm) => perm?.permission?.code === 'DASH',
        );
        this.changeDetectorRef.markForCheck();
      });

    combineLatest([
      this.authService.accounts$,
      this.indexService.targets$,
      this.posService.pos$,
    ])
      .pipe(
        takeUntil(this.unsubscribeAll),
        rxMap(([accounts, targets, pos]) => {
          this.loadingTargets$.next(true);
          this.allTargets = map(targets, (target) => ({
            target,
          }));
          this.accounts = accounts;
          this.originalAccounts = accounts;
          this.posList = map(accounts, (account) => account?.target?.pos);
          this.selectedAccount = find(
            accounts,
            (account: AccountType) => account?.target?.pos?.id === pos?.id,
          );
          const filteredPermissions = filter(
            this.selectedAccount?.permission?.permissions,
            (perm: PermissionPermissionsType) =>
              perm?.read || perm.update || perm.create,
          );
          this.dashboardPermission = !!filteredPermissions.find(
            (perm) => perm?.permission?.code === 'CAMP_DASH',
          );
          this.EcomDashboardPermission = !!filteredPermissions.find(
            (perm) => perm?.permission?.code === 'ECOM_DASH',
          );
          this.KycDashboardPermission = !!filteredPermissions.find(
            (perm) => perm?.permission?.code === 'KYC_DASH',
          );
          this.EngDashboardPermission = !!filteredPermissions.find(
            (perm) => perm?.permission?.code === 'ENG_DASH',
          );

          const filteredTargets: any = map(targets, (target) => ({
            target,
            isActive: this.posList?.some((pos) => pos.id === target.id),
            disabled: this.posList?.some((pos) => pos.id === target.id),
          }));
          return this.selectedUser ? this.allTargets : filteredTargets;
        }),
      )
      .subscribe((filteredTargets: any) => {
        this.filteredTargets = filteredTargets;
        this.loadingTargets$.next(false);
        setTimeout(() => {
          window.dispatchEvent(new Event('resize'));
        });
        this.changeDetectorRef.markForCheck();
      });
    this.userService.user$
      .pipe(takeUntil(this.unsubscribeAll))
      .subscribe((user) => {
        this.theme = user?.mobileTheme;
      });
    this.userId = this.storageHelper.getData('currentUserId');
    this.featuredData = featuredData;

    this.userService.currentUser$
      .pipe(takeUntil(this.unsubscribeAll))
      .subscribe((currentUser) => {
        this.isAdmin = some(
          currentUser?.roles,
          (role) => role === UserRole.ADMIN,
        );
      });

    this.indexService.dashboards$
      .pipe(takeUntil(this.unsubscribeAll))
      .subscribe((dashboards) => {
        // Keep only dashboards the user has permission to see
        const permittedDashboards = (dashboards || []).filter((d) =>
          this.isDashboardPermitted(d?.dashboard as DashboardEnum),
        );
        this.dashboards = permittedDashboards;
        const excludedDashboards = [
          DashboardEnum.ANALYTICS,
          DashboardEnum.COLLABORATION,
          DashboardEnum.CRM,
          DashboardEnum.SALES,
        ];
        const existingDashboards = map(this.dashboards, 'dashboard');
        // Candidate dashboards the user can add (not excluded, not already present) AND permitted by permissions
        this.filteredDashboards = difference(
          without(this.dashTypes, ...excludedDashboards),
          existingDashboards,
        ).filter((d: DashboardEnum) => this.isDashboardPermitted(d));
        this.changeDetectorRef.markForCheck();
      });

    this.indexService.activeQuests$
      .pipe(takeUntil(this.unsubscribeAll))
      .subscribe((activeQuests) => {
        this.activeQuests = activeQuests;
        this.changeDetectorRef.markForCheck();
      });

    this.indexService.currentTab$
      .pipe(takeUntil(this.unsubscribeAll))
      .subscribe((tab) => {
        this.activeTab = tab;
        this.changeDetectorRef.markForCheck();
      });
    combineLatest([
      this.indexService.getCorporateUsersStats(),
      this.kycService.getUsersCumulativeCount(
        this.startDate,
        this.endOfYesterday,
      ),
      this.kycService.getUsersNonCumulativeCount(
        this.startDate,
        this.endOfYesterday,
      ),
    ]).subscribe();
    this.dashboardCampaignsService.dashboardChart$
      .pipe(takeUntil(this.unsubscribeAll))
      .subscribe((chart) => {
        this.totalCampaignsData = chart?.find(
          (c) => c.name === 'TOTAL_CAMPAIGNS',
        );
        if (this.totalCampaignsData) {
          this.campaignsChart = this.getCampaignsChart(
            this.totalCampaignsData.data,
          );
          this.changeDetectorRef.markForCheck();
        }
        this.changeDetectorRef.markForCheck();
      });
    this.kycService.nonCumulative$
      .pipe(takeUntil(this.unsubscribeAll))
      .subscribe((nonCumulative) => {
        this.nonCumulative = nonCumulative;
        if (nonCumulative) {
          this.nonCumulativeChart = this.getNonCumulativeChart(
            nonCumulative.chart,
          );
          this.changeDetectorRef.markForCheck();
        }
      });
    this.kycService.cumulative$
      .pipe(takeUntil(this.unsubscribeAll))
      .subscribe((cumulative) => {
        this.cumulative = cumulative;
        if (cumulative) {
          this.cumulativeChart = this.getNonCumulativeChart(cumulative.chart);
          this.changeDetectorRef.markForCheck();
        }
      });
    this.indexService.usersStats$
      .pipe(takeUntil(this.unsubscribeAll))
      .subscribe((usersStats) => {
        this.usersStats = usersStats;
        if (usersStats) {
          this.generateStatData(usersStats);
        }
      });

    combineLatest([
      this.indexService.quests$,
      this.indexService.simpleProducts$,
      this.indexService.corporateUsers$,
      this.indexService.projects$,
      this.indexService.blogs$,
      this.indexService.barcodes$,
    ]).subscribe(([res1, res2, res3, res4, res5, res6]) => {
      this.indexService.searchString = this.searchValue;
      switch (this.activeTab) {
        case 1:
          this.searchedItems = [
            {
              items: res1,
              label: 'campaigns',
              router: 'engagement/campaigns/campaigns',
            },

            {
              items: res2,
              label: 'products',
              router: 'inventory/products/products',
            },
            ,
            {
              items: res3,
              label: 'customers',
              router: 'ecommerce/customers/customers',
            },
            ,
            {
              items: res4,
              label: 'projects',
              router: 'collaboration/projects/all',
            },
            {
              items: res5,
              label: 'blogs',
              router: 'website/blog',
            },
            {
              items: res6,
              label: 'articles',
              router: 'inventory/products/articles',
            },
          ];
          break;
        case 2:
          this.searchedItems = res1;
          this.indexService.loadingItems$ = false;
          break;
        case 3:
          this.searchedItems = res2;
          this.indexService.loadingItems$ = false;
          break;
        case 4:
          this.searchedItems = res3;
          this.indexService.loadingItems$ = false;
          break;
        case 5:
          this.searchedItems = res4;
          this.indexService.loadingItems$ = false;
          break;
        case 6:
          this.searchedItems = res5;
          this.indexService.loadingItems$ = false;
          break;
        case 7:
          this.searchedItems = res6;
          this.indexService.loadingItems$ = false;
          break;
        default:
          break;
      }
      this.indexService.loadingItems$ = false;
      this.updatePagination();
      this.changeDetectorRef.markForCheck();
    });
    this.engagementService.getEngagementProgressionOverTime().subscribe();
    this.engagementService.progressionOverTime$
      .pipe(takeUntil(this.unsubscribeAll))
      .subscribe((progression) => {
        this.activeUsers = find(progression, { name: 'ACTIVE_USERS' });

        if (this.activeUsers) {
          const data = this.getFilteredData(
            this.activeUsers.data,
            this.progressionYear,
          );
          this.getActiveUsersChart(data);

          if (!this.hasCheckedRecursively && data.every((n) => n === 0)) {
            this.hasCheckedRecursively = true;
            this.checkEngagementRecursively(this.progressionYear - 1);
          }
        }

        this.changeDetectorRef.markForCheck();
      });
  }

  onChangeUserAccount() {
    this.selectedUserPermission = this.selectedUserAccount?.permission;
  }

  addTargetsToAccount() {
    this.isTargetButtonDisabled = true;
    const target = this.assignTargetForm.get('target').value;
    let request$: Observable<any>;
    if (this.selectedUser) {
      request$ = this.teamService
        .createAccount(this.selectedUser.id, target)
        .pipe(
          switchMap((res) =>
            this.authService.addAccountPermission(
              this.selectedUserPermission?.id,
              res,
              this.selectedUser.id,
            ),
          ),
        );
    } else {
      request$ = this.authService.addTargetToAccount(
        target,
        null,
        this.assignTargetForm.get('permission')?.value.id,
      );
    }
    request$
      .pipe(
        catchError(() => {
          this.modalError();
          this.modalService.dismissAll();
          this.changeDetectorRef.markForCheck();
          return of(null);
        }),
      )
      .subscribe((res) => {
        if (res) {
          this.position();
          this.modalService.dismissAll();
          this.changeDetectorRef.markForCheck();
        }
      });
  }

  onChangeAccount(target) {
    this.teamService.searchString = '';
    this.teamService.page = 0;
    this.teamService.infiniteUsers$ = null;
    const targetId = target?.target?.id;
    this.rolesService
      .getPermissionsByTarget(targetId)
      .pipe(
        switchMap((permissions) => {
          this.permissions = permissions;
          return this.rolesService.getPermissionDefinition();
        }),
      )
      .subscribe((res) => {
        if (res) {
          this.definitions = res;
          this.originalDefinitions = res;
          this.changeDetectorRef.markForCheck();
        }
      });
  }

  onChartChange(event: any) {
    const startIndex = event?.startPosition;
    this.selectedWalletIndex = startIndex;
    const selectedWallet = this.wallets[this.selectedWalletIndex];
    this.currency = selectedWallet?.coin?.unitValue?.currency?.name;
    this.walletService
      .getWalletTransactionsStatsChartWithFilter({
        from: this.startDate,
        to: this.endOfYesterday,
        wallet: selectedWallet?.id,
      } as any)
      .subscribe();
  }

  getActiveUsersChart(data: number[]) {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const slicedMonths = months.slice(-data.length);
    this.activeUsersChart = {
      series: [
        {
          name: this.translate.instant('COMMON.ACTIVE_USERS'),
          data: data.map((value, index) => ({
            x: slicedMonths[index],
            y: value,
          })),
        },
      ],
      seriess: [
        {
          name: this.translate.instant('COMMON.ACTIVE_USERS'),
          data: data,
        },
      ],
      chart: {
        width: 130,
        height: 50,
        type: 'area',
        sparkline: {
          enabled: true,
        },
        toolbar: {
          show: false,
        },
      },
      dataLabels: {
        enabled: false,
      },
      stroke: {
        curve: 'smooth',
        width: 1.5,
      },
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          inverseColors: false,
          opacityFrom: 0.45,
          opacityTo: 0.05,
          stops: [50, 100, 100, 100],
        },
      },
      colors: ['#0ab39c'],
    };
  }

  getNonCumulativeChart(data: number[][]) {
    const seriesData = data.map(([timestamp, count]) => ({
      x: new Date(timestamp).toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
      }),
      y: count,
    }));
    return {
      series: [
        {
          name: this.translate.instant('MENUITEMS.TS.USERS'),
          data: seriesData,
        },
      ],
      chart: {
        type: 'area',
        height: 70,
        toolbar: { show: false },
        zoom: { enabled: true },
        sparkline: { enabled: true },
      },
      dataLabels: { enabled: false },
      stroke: {
        curve: 'smooth',
        width: 1.5,
      },
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          inverseColors: false,
          opacityFrom: 0.45,
          opacityTo: 0.05,
          stops: [50, 100, 100, 100],
        },
      },
      xaxis: {
        show: false,
        labels: { show: false },
      },
      yaxis: { show: false },
      tooltip: {
        x: {
          formatter: (val: string) => val, // Keep "25 May" as-is
        },
      },
      colors: [this.getChartColor(data)],
    };
  }

  getCampaignsChart(data: number[]) {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const seriesData = data.map((count, index) => ({
      x: months[index],
      y: count,
    }));

    // Convert data format for getChartColor method (expects number[][] format)
    const chartColorData = data.map((count, index) => [index, count]);

    return {
      series: [
        {
          name: this.translate.instant('MENUITEMS.TS.CAMPAIGNS'),
          data: seriesData,
        },
      ],
      chart: {
        width: 130,
        height: 50,
        type: 'bar',
        sparkline: {
          enabled: true,
        },
        toolbar: {
          show: false,
        },
      },
      dataLabels: {
        enabled: false,
      },
      stroke: {
        curve: 'smooth',
        width: 1.5,
      },
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          inverseColors: false,
          opacityFrom: 0.45,
          opacityTo: 0.05,
          stops: [50, 100, 100, 100],
        },
      },
      colors: [this.getChartColor(chartColorData)],
    };
  }

  openAssignTargetModal(content: any) {
    this.resetFields();
    this.selectedUser = null;
    this.isCreatePermission = false;
    this.activeId = 1;
    this.indexService.posPageIndex = 0;
    this.indexService.targets$ = null;
    this.teamService.users$ = null;
    this.teamService.usersPageIndex = 0;
    this.rolesService.permissionsDef$
      .pipe(takeUntil(this.unsubscribeAll))
      .subscribe((definitions) => {
        this.definitions = definitions;
        this.originalDefinitions = definitions;
        if (definitions?.length) {
          this.rolesForm = this.formBuilder.group({
            name: [''],
            permissions: this.formBuilder.array(
              definitions.map((role) => {
                return this.formBuilder.group({
                  permission: [role],
                  read: [false],
                  update: [false],
                  create: [false],
                });
              }),
            ),
          });
          const initialValue = this.rolesForm.value;
          this.rolesForm.valueChanges
            .pipe(takeUntil(this.unsubscribeAll))
            .subscribe((values) => {
              this.isRoleButtonDisabled = isEqual(values, initialValue);
            });
        }
      });
    this.indexService.searchPos().subscribe();
    this.modalService.open(content, {
      centered: true,
      size: 'lg',
      backdrop: 'static',
    });
    this.assignTargetForm = this.formBuilder.group({
      target: [undefined, Validators.required],
      permission: [undefined, Validators.required],
    });
    const initValue = this.assignTargetForm.value;
    this.assignTargetForm.valueChanges
      .pipe(takeUntil(this.unsubscribeAll))
      .subscribe((values) => {
        this.isTargetButtonDisabled = isEqual(values, initValue);
      });
  }

  onChangeTarget(target, field?: string) {
    console.log('🚀 ~ IndexComponent ~ onChangeTarget ~ target:', target);
    this.teamService.searchString = '';
    this.teamService.page = 0;
    this.teamService.infiniteUsers$ = null;
    const targetId =
      field === 'account' ? target?.target?.pos?.id : target?.target?.id;
    this.selectedTargetAccount = find(
      this.accounts,
      (account: AccountType) => account?.target?.pos?.id === targetId,
    );
    console.log(
      '🚀 ~ IndexComponent ~ onChangeTarget ~ this.selectedTargetAccount:',
      this.selectedTargetAccount,
    );
    this.selectedPermission = this.selectedTargetAccount?.permission;
    combineLatest([
      this.rolesService.getPermissionsByTarget(targetId),
      this.teamService.searchAccount(false, targetId),
    ])
      .pipe(
        switchMap(([permissions, accounts]) => {
          this.permissions = permissions;
          this.userAccounts = accounts;
          return this.rolesService.getPermissionDefinition();
        }),
      )
      .subscribe((res) => {
        if (res) {
          this.definitions = res;
          this.originalDefinitions = res;
          this.changeDetectorRef.markForCheck();
        }
      });
  }

  checkEngagementRecursively(year: number): void {
    if (year < 2024) {
      this.progressionYear = 2025;
      this.hasCheckedRecursively = false;
      return;
    }

    this.engagementService
      .getEngagementProgressionOverTime(year)
      .subscribe((progression) => {
        const activeUsers = find(progression, { name: 'ACTIVE_USERS' });

        if (activeUsers) {
          const data = this.getFilteredData(activeUsers.data, year);

          this.activeUsers = activeUsers;

          this.getActiveUsersChart(data);

          if (data.some((n) => n === 0)) {
            this.checkEngagementRecursively(year - 1);
            return;
          }
        }

        this.progressionYear = 2025;
        this.changeDetectorRef.markForCheck();
      });
  }

  private getFilteredData(data: number[], year: number): number[] {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    if (year < currentYear) {
      return [...data];
    } else {
      return data.slice(0, currentMonth + 1);
    }
  }

  private walletGraph(walletChart: DateValueChartType) {
    const formatLargeNumber = (value: number): string => {
      const numericValue = Number(value);
      if (isNaN(numericValue)) {
        return `0 ${this.currency || '$'}`;
      }
      // Extend suffixes for larger numbers
      const suffixes = ['', 'K', 'M', 'B', 'T', 'Q'];
      let suffixIndex = 0;

      let tempValue = numericValue;
      while (tempValue >= 1000 && suffixIndex < suffixes.length - 1) {
        tempValue /= 1000;
        suffixIndex++;
      }

      return `${tempValue.toFixed(1)}${suffixes[suffixIndex]}`;
    };
    this.translate.get('MENUITEMS.TS.BALANCE').subscribe((balance: string) => {
      const seriesData = walletChart?.chart.map(([timestamp, count]) => ({
        x: new Date(timestamp).toLocaleDateString('en-US', {
          day: '2-digit',
          month: 'short',
        }),
        y: count,
      }));
      this.walletGraphChart = {
        series: [
          {
            name: balance,
            data: seriesData,
          },
        ],
        chart: {
          id: 'area-datetime',
          type: 'area',
          height: 90,
          toolbar: { show: false },
          zoom: { enabled: true },
          sparkline: { enabled: true },
        },
        xaxis: {
          show: false,
          labels: { show: false },
        },
        yaxis: { show: false },
        dataLabels: {
          enabled: false,
        },
        stroke: {
          curve: 'smooth',
          width: 1.5,
        },
        fill: {
          type: 'gradient',
          gradient: {
            shadeIntensity: 1,
            inverseColors: false,
            opacityFrom: 0.45,
            opacityTo: 0.05,
            stops: [50, 100, 100, 100],
          },
        },
        tooltip: {
          x: {
            formatter: (value: number) => {
              return format(new Date(value), 'dd MMM yyyy');
            },
          },
          y: {
            formatter: (y: number) => {
              if (typeof y !== 'undefined') {
                return `${this.currency} ${formatLargeNumber(y)}`;
              }
              return y;
            },
          },
        },
        colors: [this.getChartColor(walletChart?.chart)],
      };
    });

    this.changeDetectorRef.markForCheck();
  }

  getChartColor(chart: number[][]) {
    const sortedData = [...chart].sort((a, b) => a[0] - b[0]);
    const counts = sortedData.map((d) => d[1]);
    const avgStart =
      counts.length >= 3
        ? (counts[0] + counts[1] + counts[2]) / 3
        : counts[0] || 0;
    const avgEnd =
      counts.length >= 6
        ? (counts[counts.length - 1] +
            counts[counts.length - 2] +
            counts[counts.length - 3]) /
          3
        : counts[counts.length - 1] || 0;
    const growth = avgEnd - avgStart;
    return growth >= 0 ? '#0ab39c' : '#f06548';
  }

  nextStep(field?: string) {
    if (field === 'skip') {
      this.selectedUser = null;
    }
    if (field === 'skip' || field === 'pos') {
      this.indexService.searchPos().subscribe();
    }
    this.activeId = this.activeId + 1;
  }

  onTabChange(event: any) {
    this.activeId = +event.nextId;
    if (this.activeId === 2) {
      this.indexService.searchPos().subscribe();
    }
  }

  toggleActivity() {
    this.transactionsUnsubscribe();
    this.walletService
      .getWalletTransactionsByAffectedPaginated({ includeAllCustomers: true })
      .pipe(
        switchMap((res) => {
          if (res) {
            return this.loyaltyService.findLoyaltySettingsByTarget();
          }
          return of(null);
        }),
      )
      .subscribe();

    this.walletService.listenForTransactionSubscription = this.walletService
      .listenForTransactionAndEvents()
      .pipe(takeUntil(this.walletService.listenUnsubscribe))
      .subscribe();

    const recentActivity = document.querySelector('.layout-rightside-col');
    if (recentActivity != null) {
      recentActivity.classList.toggle('d-none');
    }

    if (document.documentElement.clientWidth <= 1700) {
      const recentActivity = document.querySelector('.layout-rightside-col');
      if (recentActivity != null) {
        recentActivity.classList.add('d-block');
        recentActivity.classList.remove('d-none');
      }
    }
    window.dispatchEvent(new Event('resize'));
  }

  sidebarHide() {
    const recentActivity = document.querySelector('.layout-rightside-col');
    if (recentActivity != null) {
      recentActivity.classList.remove('d-block');
    }
  }

  transactionsUnsubscribe() {
    this.walletService.transactionPageIndex = 0;
    this.walletService.infiniteTransactions$ = null;
    this.walletService.newTransaction$ = null;
    this.walletService.listenUnsubscribe.next(true);
    this.walletService.listenUnsubscribe.complete();
    if (this.walletService.listenForTransactionSubscription) {
      this.walletService.listenForTransactionSubscription.unsubscribe();
    }
  }

  loadMoreUserAccounts() {
    this.teamService.isLast$.pipe(take(1)).subscribe((isLast: boolean) => {
      if (!isLast) {
        this.teamService.page++;
        this.teamService.searchAccount().subscribe();
      }
    });
  }

  openAssignPermissionModal(content: any) {
    this.resetFields();
    this.activeId = 1;
    this.modalService.open(content, {
      centered: true,
      size: 'lg',
      backdrop: 'static',
    });
  }

  assignPermissionToAccount() {
    this.authService
      .addAccountPermission(
        this.selectedUserPermission?.id,
        this.selectedTargetAccount,
        this.selectedUserAccount?.user?.id,
      )
      .pipe(
        catchError(() => {
          this.modalService.dismissAll();
          this.modalError();
          this.changeDetectorRef.markForCheck();
          return of(null);
        }),
      )
      .subscribe((res) => {
        if (res) {
          this.position();
          this.modalService.dismissAll();
          this.changeDetectorRef.markForCheck();
        }
      });
  }

  filterRoles(searchTerm: string) {
    this.definitions = filter(
      this.originalDefinitions,
      (def: PermissionDefinitionType) =>
        def.name
          ?.toLowerCase()
          .includes(searchTerm !== null ? searchTerm?.toLowerCase() : ''),
    );
    this.patchRolesForm(this.currentPermission);
  }

  filterAccounts(searchTerm: string) {
    this.accounts = filter(this.originalAccounts, (account: AccountType) =>
      (account?.target?.pos?.title || account?.target?.pos?.name)
        ?.toLowerCase()
        .includes(searchTerm !== null ? searchTerm?.toLowerCase() : ''),
    );
  }

  SeeMoreRoles(permission) {
    this.displayRoles = !this.displayRoles;
    if (this.definitions?.length) {
      this.patchRolesForm(permission);
    }
  }

  openAddPermissionModal(content: any, permission: PermissionType) {
    this.currentPermission = permission;
    this.activeId = 1;
    this.selectedPos = null;
    this.selectedPermission = null;
    this.isCreatePermission = false;
    this.indexService.posPageIndex = 0;
    this.indexService.targets$ = null;
    this.indexService.searchPos().subscribe();
    this.modalService.open(content, {
      centered: true,
      size: 'lg',
      backdrop: 'static',
    });
    combineLatest([
      this.rolesService.permissionsDef$,
      this.rolesService.permissions$,
    ])
      .pipe(takeUntil(this.unsubscribeAll))
      .subscribe(([definitions, permissions]) => {
        this.originalDefinitions = definitions;
        this.definitions = definitions;
        this.permissions = permissions;
        if (definitions?.length) {
          this.patchRolesForm(permission);
        }
        this.changeDetectorRef.markForCheck();
      });
  }

  patchRolesForm(permission: PermissionType) {
    this.rolesForm = this.formBuilder.group({
      name: [permission?.name || ''],
      permissions: this.formBuilder.array(
        permission?.permissions?.length
          ? map(permission.permissions, (role) => {
              return this.formBuilder.group({
                permission: [role?.permission],
                read: [role?.read === true ? true : false],
                update: [role?.update === true ? true : false],
                create: [role?.create === true ? true : false],
              });
            })
          : this.definitions.map((role) => {
              return this.formBuilder.group({
                permission: [role],
                read: [false],
                update: [false],
                create: [false],
              });
            }),
      ),
    });
  }

  addPermission() {
    this.selectedPermission = null;
    this.isCreatePermission = !this.isCreatePermission;
    this.patchRolesForm(null);
  }

  editPermission(permission: PermissionType) {
    this.selectedPermission = permission;
    this.isCreatePermission = true;
    this.rolesForm.patchValue({
      name: permission?.name,
      permissions: map(permission.permissions, (role) => {
        return {
          permission: role?.permission,
          read: role?.read,
          update: role?.update,
          create: role?.create,
        };
      }),
    });
  }

  toggleCheckAll(): void {
    this.isAllChecked = !this.isAllChecked;
    this.permissionsArray.controls.forEach((group) => {
      group.patchValue({
        read: this.isAllChecked,
        update: this.isAllChecked,
        create: this.isAllChecked,
      });
    });
  }

  selectPermission(
    permission: PermissionType,
    field?: string,
    isAssignTarget = false,
  ) {
    if (isAssignTarget) {
      this.assignTargetForm.get('permission').patchValue(permission.id);
    }
    if (field === 'user') {
      this.selectedUserPermission = permission;
    } else {
      this.selectedPermission = permission;
    }
    this.patchRolesForm(permission);
  }

  savePermission() {
    const input: any = {
      name: this.rolesForm.get('name').value,
      permissions: map(this.permissionsArray.value, (role) => {
        return {
          permission: role?.permission?.id,
          read: role?.read,
          update: role?.update,
          create: role?.create,
        };
      }),
    };
    this.modalService.dismissAll();
    if (this.selectedPermission?.id) {
      this.rolesService
        .updatePermission(this.selectedPermission?.id, input)
        .pipe(
          catchError(() => {
            this.modalService.dismissAll();
            this.modalError();
            this.changeDetectorRef.markForCheck();
            return of(null);
          }),
        )
        .subscribe((res) => {
          if (res) {
            this.position();
            this.changeDetectorRef.markForCheck();
          }
        });
    } else {
      this.rolesService
        .createPermission(input, this.selectedPos?.target?.id)
        .pipe(
          catchError(() => {
            this.modalService.dismissAll();
            this.changeDetectorRef.markForCheck();
            return of(null);
          }),
        )
        .subscribe((res) => {
          if (res) {
            this.position();
            this.modalService.dismissAll();
            this.changeDetectorRef.markForCheck();
          }
        });
    }
  }

  permissionsCount(permissions: PermissionPermissionsType[]) {
    return permissions?.filter(
      (role) => role?.create || role?.read || role?.update,
    ).length;
  }

  resetFields() {
    this.selectedPermission = null;
    this.selectedUserPermission = null;
    this.selectedTargetAccount = null;
    this.selectedUserAccount = null;
    this.displayRoles = false;
  }

  createPermission() {
    const input: any = {
      name: this.rolesForm.get('name').value,
      permissions: map(this.permissionsArray.value, (role) => {
        return {
          permission: role?.permission?.id,
          read: role?.read,
          update: role?.update,
          create: role?.create,
        };
      }),
    };
    this.rolesService
      .createPermission(input)
      .pipe(
        catchError(() => {
          this.modalService.dismissAll();
          this.modalError();
          this.changeDetectorRef.markForCheck();
          return of(null);
        }),
      )
      .subscribe((res) => {
        if (res) {
          this.assignTargetForm.get('permission').patchValue(res?.id);
          this.addTargetsToAccount();
          this.changeDetectorRef.markForCheck();
        }
      });
  }

  openDeletePopup(content: any, posId: string) {
    this.selectedPosId = posId;
    this.modalService.dismissAll();
    this.modalService.open(content, { centered: true });
  }

  openDeleteTargetModal(content: any) {
    this.modalService.open(content, {
      centered: true,
      size: 'lg',
      backdrop: 'static',
    });
  }

  deleteTargetsFromAccount() {
    this.authService
      .deleteTargetFromAccount(this.selectedPosId)
      .pipe(
        catchError(() => {
          this.modalError();
          this.modalService.dismissAll();
          this.changeDetectorRef.markForCheck();
          return of(null);
        }),
      )
      .subscribe((res) => {
        if (res) {
          this.position();
          this.modalService.dismissAll();
          this.changeDetectorRef.markForCheck();
        }
      });
  }

  loadMoreUsers() {
    this.teamService.isLastUsers$.pipe(take(1)).subscribe((isLast: boolean) => {
      if (!isLast) {
        this.teamService.usersPageIndex++;
        this.teamService.searchUser().subscribe();
      }
    });
  }

  loadMoreTargets() {
    this.indexService.isLastTargets$
      .pipe(take(1))
      .subscribe((isLast: boolean) => {
        if (!isLast) {
          this.indexService.posPageIndex++;
          this.indexService.searchPos().subscribe();
        }
      });
  }

  openCreatePosModal(content: any) {
    this.modalService.open(content, {
      centered: true,
      size: 'lg',
      backdrop: 'static',
    });
    this.createPosForm = this.formBuilder.group({
      company: this.formBuilder.group({
        name: ['', Validators.required],
      }),
      pos: this.formBuilder.group({
        picture: this.formBuilder.group({
          baseUrl: [''],
          path: [''],
        }),
        email: ['', [Validators.required, Validators.email]],
        title: [''],
        name: ['', Validators.required],
      }),
    });
    this.initValue = this.createPosForm.value;
    this.createPosForm.valueChanges
      .pipe(takeUntil(this.unsubscribeAll))
      .subscribe((values) => {
        this.isPosButtonDisabled = isEqual(values, this.initValue);
      });
  }

  createPos() {
    this.loadingCreatePos = true;
    const input: any = {
      ...FormHelper.getNonEmptyValues(
        omit(this.createPosForm.get('pos').value, 'picture'),
      ),
      ...(this.picture.get('path').value
        ? { picture: this.picture.value }
        : {}),
    };
    this.companyService
      .createCompany(this.createPosForm.get('company').value)
      .pipe(
        catchError(() => {
          this.loadingCreatePos = false;
          this.changeDetectorRef.markForCheck();
          return of(null);
        }),
        switchMap((res) => {
          return this.posService.createPointOfSale({
            ...input,
            company: res?.id,
          });
        }),
        catchError(() => {
          this.loadingCreatePos = false;
          this.changeDetectorRef.markForCheck();
          return of(null);
        }),
      )
      .subscribe((res) => {
        if (res) {
          this.saveSuccess = true;
          this.loadingCreatePos = false;
          this.changeDetectorRef.markForCheck();
        }
      });
  }

  upload(): void {
    const fileInput = this.document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.name = 'fileUpload';
    fileInput.id = 'fileUpload';
    fileInput.onchange = async () => {
      const file = fileInput.files[0];
      const posId = this.storageHelper.getData('posId');
      const timestamp = Date.now();
      const fileName = `${posId}_${timestamp}_${file.name}`;
      this.generateS3SignedUrlGQL
        .fetch({
          fileName,
          fileType: file.type,
        })
        .subscribe(async (res) => {
          const picture = await this.amazonS3Helper.uploadS3AwsWithSignature(
            res.data.generateS3SignedUrl.message,
            file,
            fileName,
            AWS_CREDENTIALS.storage,
            AWS_CREDENTIALS.region,
          );
          this.picture.patchValue({
            path: picture.path,
            baseUrl: picture.baseUrl,
          });
          this.changeDetectorRef.markForCheck();
        });
    };
    fileInput.click();
  }

  removePicture(): void {
    const fileName = this.picture.value.path;
    this.deleteFileFromAwsGQL.fetch({ fileName }).subscribe(({ data }) => {
      if (data.deleteFileFromAws) {
        this.picture.patchValue({
          baseUrl: '',
          path: '',
        });
        this.changeDetectorRef.markForCheck();
      }
    });
  }

  generateStatData(usersData: GamificationGetCorporateUsersStatsDashboardType) {
    const translationKeys = [
      'MENUITEMS.TS.NEW_USERS_TODAY',
      'MENUITEMS.TS.NEW_USERS_THIS_MONTH',
      'MENUITEMS.TS.ACTIVE_USERS_LAST_60_DAYS',
      'MENUITEMS.TS.RETURNING_USERS_LAST_60_DAYS',

      'MENUITEMS.TS.NEW_USERS_TODAY_DESC',
      'MENUITEMS.TS.NEW_USERS_THIS_MONTH_DESC',
      'MENUITEMS.TS.ACTIVE_USERS_LAST_60_DAYS_DESC',
      'MENUITEMS.TS.RETURNING_USERS_LAST_60_DAYS_DESC',

      'MENUITEMS.TS.NEW_USERS_YESTERDAY_DESC',
      'MENUITEMS.TS.NEW_USERS_THE_PREVIEWS_MONTH_DESC',
      'MENUITEMS.TS.ACTIVE_USERS_COMPARISATION_DESC',
      'MENUITEMS.TS.RETURNING_USERS_COMPARISATION_DESC',
    ];
    return this.translate.get(translationKeys).subscribe((translations) => {
      this.usersData = [
        {
          title: translations['MENUITEMS.TS.NEW_USERS_TODAY'],
          value: `${usersData.newUsersToday.current}`,
          icon: 'check-circle',
          tooltip: translations['MENUITEMS.TS.NEW_USERS_TODAY_DESC'],
          compareTooltip: translations['MENUITEMS.TS.NEW_USERS_YESTERDAY_DESC'],
          percentage: `${usersData.newUsersToday.percentage}`,
          profit: true,
          count: `${usersData.newUsersToday.previous}`,
          icon_bg_color: 'bg-success',
          item: 'NEW_USERS_TODAY',
        },
        {
          title: translations['MENUITEMS.TS.NEW_USERS_THIS_MONTH'],
          value: `${usersData.newUsersThisMonth.current}`,
          icon: 'alert-octagon',
          tooltip: translations['MENUITEMS.TS.NEW_USERS_THIS_MONTH_DESC'],
          compareTooltip:
            translations['MENUITEMS.TS.NEW_USERS_THE_PREVIEWS_MONTH_DESC'],
          percentage: `${usersData.newUsersThisMonth.percentage}`,
          count: `${usersData.newUsersThisMonth.previous}`,
          profit: false,
          icon_bg_color: 'bg-warning',
          item: 'NEW_USERS_THIS_MONTH',
        },
        {
          title: translations['MENUITEMS.TS.ACTIVE_USERS_LAST_60_DAYS'],
          value: Number(usersData.activeUsersLast60Days.current),
          icon: 'archive',
          percentage: `${usersData.activeUsersLast60Days.percentage}`,
          compareTooltip:
            translations['MENUITEMS.TS.ACTIVE_USERS_COMPARISATION_DESC'],
          count: `${usersData.activeUsersLast60Days.previous}`,
          profit: false,
          tooltip: translations['MENUITEMS.TS.ACTIVE_USERS_LAST_60_DAYS_DESC'],
          icon_bg_color: 'bg-danger',
          item: 'ACTIVE_USERS_LAST_60_DAYS',
        },
        {
          title: translations['MENUITEMS.TS.RETURNING_USERS_LAST_60_DAYS'],
          value: `${usersData.returningUsersLast60Days.current}`,
          icon: 'pie-chart',
          tooltip:
            translations['MENUITEMS.TS.RETURNING_USERS_LAST_60_DAYS_DESC'],
          compareTooltip:
            translations['MENUITEMS.TS.RETURNING_USERS_COMPARISATION_DESC'],
          percentage: `${usersData.returningUsersLast60Days.percentage}`,
          count: `${usersData.returningUsersLast60Days.previous}`,
          profit: null,
          icon_bg_color: 'bg-primary',
          item: 'RETURNING_USERS_LAST_60_DAYS',
        },
      ];
    });
  }

  searchItems() {
    this.isSearchButtonDisabled = true;
    this.searchedItems = null;
    this.switchItems();
  }

  updatePagination() {
    this.indexService.pagination$
      .pipe(takeUntil(this.unsubscribeAll))
      .subscribe((pagination) => {
        if (this.subscription) {
          this.subscription.unsubscribe();
        }
        this.pagination$ = pagination;
        this.subscription = this.pagination$
          .pipe(takeUntil(this.unsubscribeAll))
          .subscribe((paginateResponse: IPagination) => {
            this.paginations = {
              length: paginateResponse?.length,
              page: this.indexService.pageIndex || 0,
              size: this.pageLimit,
              lastPage: paginateResponse?.length - 1,
              startIndex: (this.indexService.pageIndex || 0) * this.pageLimit,
              endIndex: Math.min(
                ((this.indexService.pageIndex || 0) + 1) * this.pageLimit - 1,
                paginateResponse?.length - 1,
              ),
            };
            this.changeDetectorRef.markForCheck();
          });
      });
  }

  switchItems() {
    this.indexService.loadingItems$ = true;
    this.indexService.searchString = this.searchValue;
    switch (this.activeTab) {
      case 1:
        forkJoin([
          this.indexService.findNonPredefinedQuestsByTarget(5),
          this.indexService.getSimpleProductWithFilter(5),
          this.indexService.searchCorporateUsersByTarget(5),
          this.indexService.getProjectsByTargetWithFilter(5),
          this.indexService.findBlogsByTargetPaginated(5),
          this.indexService.getBarcodesByTargetPaginated(5),
        ]).subscribe();
        break;
      case 2:
        this.indexService.findNonPredefinedQuestsByTarget(5).subscribe();
        break;
      case 3:
        this.indexService.getSimpleProductWithFilter(5).subscribe();
        break;
      case 4:
        this.indexService.searchCorporateUsersByTarget(5).subscribe();
        break;
      case 5:
        this.indexService.getProjectsByTargetWithFilter(5).subscribe();
        break;
      case 6:
        this.indexService.findBlogsByTargetPaginated(5).subscribe();
        break;
      case 7:
        this.indexService.getBarcodesByTargetPaginated(5).subscribe();
        break;
      default:
        break;
    }
  }

  onNavChange(event) {
    this.searchedItems = null;
    this.itemPage = 0;
    this.indexService.pageIndex = 0;
    this.isSearchButtonDisabled = this.searchValue === '' ? true : false;
    this.indexService.currentTab$ = event?.nextId;
    this.switchItems();
  }

  onPageChange(page: number) {
    this.itemPage = page;
    if (this.itemPage > 1) {
      this.pageChanged = true;
    }
    this.indexService.pageIndex = page - 1;
    if (this.pageChanged) {
      this.switchItems();
    }
  }

  calculateLast4Months() {
    const currentDate = new Date();
    const lastMonth = subMonths(currentDate, 1);
    const last4Months = times(4, (index) => subMonths(lastMonth, index));
    this.lastMonths = reverse(
      map(last4Months, (date) => format(date, 'MMM yyyy')),
    );
  }

  sectionDropped(event: CdkDragDrop<any[]>): void {
    const dashboardsCopy = [...this.dashboards];
    const item = dashboardsCopy[event.previousIndex];
    let newRank =
      event.currentIndex === 0 ? 1 : dashboardsCopy[event.currentIndex].rank;
    moveItemInArray(dashboardsCopy, event.previousIndex, event.currentIndex);
    this.dashboards = dashboardsCopy;
    const input: any = {
      dashboardId: item?.id,
      newRank,
    };

    this.indexService
      .reorderCorporateDashboard(input)
      .pipe(
        catchError(() => {
          this.modalError();
          this.changeDetectorRef.markForCheck();
          return of(null);
        }),
      )
      .subscribe((res) => {
        if (res) {
          this.position();
          this.changeDetectorRef.markForCheck();
        }
      });
  }

  openDashboardModal(content: any, dashboard: CorporateUserDashType) {
    this.selectedDashboard = dashboard;
    this.modalService.open(content, { centered: true });
    this.dashboardForm = this.formBuilder.group({
      dashboard: [dashboard?.dashboard || undefined, Validators.required],
    });
    this.initialValues = this.dashboardForm.value;
    this.dashboardForm.valueChanges
      .pipe(takeUntil(this.unsubscribeAll))
      .subscribe((ivalues) => {
        this.isButtonDisabled = isEqual(ivalues, this.initialValues);
      });
  }

  save() {
    this.isButtonDisabled = true;
    const input: any = {
      user: this.userId,
      ...(this.selectedDashboard ? { id: this.selectedDashboard.id } : {}),
      ...(this.dashboardForm.get('dashboard').value ===
      this.initialValues.dashboard
        ? {}
        : { dashboard: this.dashboardForm.get('dashboard').value }),
      ...(this.selectedDashboard
        ? { rank: this.selectedDashboard?.rank }
        : { rank: this.dashboards?.length + 1 }),
    };
    if (this.selectedDashboard) {
      this.indexService
        .updateCorporateDashboard(input)
        .pipe(
          catchError(() => {
            this.modalError();
            this.modalService.dismissAll();
            this.changeDetectorRef.markForCheck();
            return of(null);
          }),
        )
        .subscribe((res) => {
          if (res) {
            this.position();
            this.modalService.dismissAll();
            this.changeDetectorRef.markForCheck();
          }
        });
    } else {
      this.indexService
        .createCorporateDashboard(input)
        .pipe(
          catchError((error) => {
            this.modalError();
            this.changeDetectorRef.markForCheck();
            return of(null);
          }),
        )
        .subscribe((res) => {
          if (res) {
            this.position();
            this.modalService.dismissAll();
            this.changeDetectorRef.markForCheck();
          }
        });
    }
  }

  openDeleteModal(content: any, dashboard: CorporateUserDashType) {
    this.selectedDashboard = dashboard;
    this.modalService.open(content, { centered: true });
  }

  deleteDashboard() {
    this.indexService
      .deleteCorporateDashboard(this.selectedDashboard.id)
      .pipe(
        catchError(() => {
          this.modalService.dismissAll();
          this.modalError();
          this.changeDetectorRef.markForCheck();
          return of(null);
        }),
      )
      .subscribe((res) => {
        if (res) {
          this.position();
          this.modalService.dismissAll();
          this.changeDetectorRef.markForCheck();
        }
      });
  }

  // Determine if a dashboard is permitted based on fetched permission flags
  private isDashboardPermitted(dashboard: DashboardEnum): boolean {
    switch (dashboard) {
      case DashboardEnum.CAMPAIGNS:
        return this.dashboardPermission ?? true; // using dashboardPermission for campaigns as per existing mapping
      case DashboardEnum.ECOMMERCE:
        return this.EcomDashboardPermission ?? true;
      case DashboardEnum.KYC:
        return this.KycDashboardPermission ?? true;
      case DashboardEnum.ENGAGEMENT:
        return this.EngDashboardPermission ?? true;
      default:
        // For any other dashboards (e.g., excluded ones), allow by default here; caller already excludes some
        return true;
    }
  }

  modalError() {
    this.translate
      .get('MENUITEMS.TS.STH_WENT_WRONG')
      .subscribe((sthWentWrong: string) => {
        Swal.fire({
          title: 'Oops...',
          text: sthWentWrong,
          icon: 'warning',
          showCancelButton: false,
          confirmButtonColor: 'rgb(3, 142, 220)',
          cancelButtonColor: 'rgb(243, 78, 78)',
        });
      });
  }

  position() {
    this.translate
      .get('MENUITEMS.TS.WORK_SAVED')
      .subscribe((workSaved: string) => {
        Swal.fire({
          position: 'top-end',
          icon: 'success',
          title: workSaved,
          showConfirmButton: false,
          timer: 1500,
        });
      });
  }

  num: number = 0;
  option = {
    startVal: this.num,
    useEasing: true,
    duration: 2,
    decimalPlaces: 0,
  };

  ngOnDestroy() {
    this.transactionsUnsubscribe();
    this.walletService.transactionPageIndex = 0;
    this.walletService.infiniteTransactions$ = null;
    this.walletService.newTransaction$ = null;
    this.teamService.searchString = '';
    this.teamService.page = 0;
    this.teamService.infiniteUsers$ = null;
    this.indexService.pageIndex = 0;
    this.indexService.searchString = '';
    this.unsubscribeAll.next(true);
    this.unsubscribeAll.complete();
    this.loyaltyService.walletPageIndex = 0;
    this.loyaltyService.wallet$ = null;
    this.walletService.listenUnsubscribe.next(true);
    this.walletService.listenUnsubscribe.complete();
    this.walletService.listenForTransactionSubscription?.unsubscribe();
  }
}
