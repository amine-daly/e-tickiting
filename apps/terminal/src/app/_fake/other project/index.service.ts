import { BehaviorSubject, Observable, map, of, switchMap, take } from 'rxjs';
import { Injectable } from '@angular/core';

import {
  BlogType,
  BarcodeType,
  ProjectType,
  SearchPosGQL,
  PointOfSaleType,
  GetMenuBadgesGQL,
  CorporateUserType,
  ProductStatusEnum,
  GetMenuBadgesType,
  InternalProductType,
  CorporateUserDashType,
  ActiveQuestsStatsType,
  QuestType,
  MainDashboardStatsType,
  AnalyticsDashboardInput,
  GetActiveQuestsStatsGQL,
  GetMainDashboardStatsGQL,
  GetTopPerformingQuestsGQL,
  AnalyticsUsersByDeviceType,
  CorporateUserDashboardInput,
  CreateCorporateDashboardGQL,
  DeleteCorporateDashboardGQL,
  UpdateCorporateDashboardGQL,
  ReorderCorporateDashboardGQL,
  GetAnalyticsUsersByDeviceGQL,
  GetSimpleProductWithFilterGQL,
  FindBlogsByTargetPaginatedGQL,
  GetUserDistributionsByLevelGQL,
  SearchCorporateUsersByTargetGQL,
  GetProjectsByTargetWithFilterGQL,
  CorporateUserDashboardUpdateInput,
  FindNonPredefinedQuestsByTargetGQL,
  GetCorporateDashboardByTargetAndUserGQL,
  GamificationTopPerformingQuestsDashboardType,
  GamificationUserDistributionsByLevelDashboardType,
  GetBarcodesByTargetWithInternalProductPaginatedGQL,
  GetCorporateUsersStatsGQL,
  GamificationGetCorporateUsersStatsDashboardType,
} from '@sifca-monorepo/terminal-generator';
import { StorageHelper } from '@diktup/frontend/helpers';
import { SortingField } from '../inventory/products/products/products.types';
import { InventoryService } from '../../shared/services/inventory.service';
import { IPagination } from '@diktup/frontend/models';
import { PosService } from '../../core/services/pos.service';
import { FetchPolicy } from '@apollo/client/core';
import { UserService } from '../../core/services/user.service';

@Injectable({
  providedIn: 'root',
})
export class IndexService {
  private isLastTargets: BehaviorSubject<boolean> = new BehaviorSubject(null);
  private currentTab: BehaviorSubject<number> = new BehaviorSubject<number>(1);
  private loadingTopQuests: BehaviorSubject<boolean> = new BehaviorSubject(null);
  private targets: BehaviorSubject<PointOfSaleType[]> = new BehaviorSubject(null);
  private menuBadges: BehaviorSubject<GetMenuBadgesType> = new BehaviorSubject(null);
  private blogs: BehaviorSubject<BlogType[]> = new BehaviorSubject<BlogType[]>(null);
  private loadingItems: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  private loadingUserDistribution: BehaviorSubject<boolean> = new BehaviorSubject(null);
  private pagination: BehaviorSubject<IPagination> = new BehaviorSubject<IPagination>(null);
  private loadingUsersStats: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(null);
  private loadingActiveQuests: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(null);
  private projects: BehaviorSubject<ProjectType[]> = new BehaviorSubject<ProjectType[]>(null);
  private barcodes: BehaviorSubject<BarcodeType[]> = new BehaviorSubject<BarcodeType[]>(null);
  private loadingMainDashboard: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(null);
  private loadingUsersByDevice: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(null);
  private loadingCorporateDashboard: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(null);
  private topQuests: BehaviorSubject<GamificationTopPerformingQuestsDashboardType> = new BehaviorSubject(null);
  private corporateUsers: BehaviorSubject<CorporateUserType[]> = new BehaviorSubject<CorporateUserType[]>(null);
  private quests: BehaviorSubject<QuestType[]> = new BehaviorSubject<QuestType[]>(null);
  private activeQuests: BehaviorSubject<ActiveQuestsStatsType> = new BehaviorSubject<ActiveQuestsStatsType>(null);
  private dashboards: BehaviorSubject<CorporateUserDashType[]> = new BehaviorSubject<CorporateUserDashType[]>(null);
  private simpleProducts: BehaviorSubject<InternalProductType[]> = new BehaviorSubject<InternalProductType[]>(null);
  private mainDashboard: BehaviorSubject<MainDashboardStatsType> = new BehaviorSubject<MainDashboardStatsType>(null);
  private userDistribution: BehaviorSubject<GamificationUserDistributionsByLevelDashboardType[]> = new BehaviorSubject(null);
  private usersByDevice: BehaviorSubject<AnalyticsUsersByDeviceType> = new BehaviorSubject<AnalyticsUsersByDeviceType>(null);
  private usersStats: BehaviorSubject<GamificationGetCorporateUsersStatsDashboardType> = new BehaviorSubject<GamificationGetCorporateUsersStatsDashboardType>(null);

  pageIndex = 0;
  pageLimit = 10;
  posPageIndex = 0;
  searchString = '';
  posSearchString = '';

  get isLastTargets$(): Observable<boolean> {
    return this.isLastTargets.asObservable();
  }

  get currentTab$(): Observable<number> {
    return this.currentTab.asObservable();
  }
  set currentTab$(value: any) {
    this.currentTab.next(value);
  }

  get loadingTopQuests$(): Observable<boolean> {
    return this.loadingTopQuests.asObservable();
  }

  get loadingUserDistribution$(): Observable<boolean> {
    return this.loadingUserDistribution.asObservable();
  }

  get blogs$(): Observable<BlogType[]> {
    return this.blogs.asObservable();
  }

  get dashboards$(): Observable<CorporateUserDashType[]> {
    return this.dashboards.asObservable();
  }

  get corporateUsers$(): Observable<CorporateUserType[]> {
    return this.corporateUsers.asObservable();
  }

  get projects$(): Observable<ProjectType[]> {
    return this.projects.asObservable();
  }

  get barcodes$(): Observable<BarcodeType[]> {
    return this.barcodes.asObservable();
  }

  get activeQuests$(): Observable<ActiveQuestsStatsType> {
    return this.activeQuests.asObservable();
  }

  get loadingUsersByDevice$(): Observable<boolean> {
    return this.loadingUsersByDevice.asObservable();
  }

  get loadingActiveQuests$(): Observable<boolean> {
    return this.loadingActiveQuests.asObservable();
  }

  get pagination$(): Observable<IPagination> {
    return this.pagination.asObservable();
  }

  get mainDashboard$(): Observable<MainDashboardStatsType> {
    return this.mainDashboard.asObservable();
  }

  get loadingMainDashboard$(): Observable<boolean> {
    return this.loadingMainDashboard.asObservable();
  }

  get usersByDevice$(): Observable<AnalyticsUsersByDeviceType> {
    return this.usersByDevice.asObservable();
  }

  get loadingCorporateDashboard$(): Observable<boolean> {
    return this.loadingCorporateDashboard.asObservable();
  }

  get simpleProducts$(): Observable<InternalProductType[]> {
    return this.simpleProducts.asObservable();
  }

  get quests$(): Observable<QuestType[]> {
    return this.quests.asObservable();
  }

  get loadingItems$(): Observable<boolean> {
    return this.loadingItems.asObservable();
  }
  set loadingItems$(value: any) {
    this.loadingItems.next(value);
  }

  get menuBadges$(): Observable<GetMenuBadgesType> {
    return this.menuBadges.asObservable();
  }

  get targets$(): Observable<PointOfSaleType[]> {
    return this.targets.asObservable();
  }
  set targets$(value: any) {
    this.targets.next(value);
  }

  get userDistribution$(): Observable<GamificationUserDistributionsByLevelDashboardType[]> {
    return this.userDistribution.asObservable();
  }
  set userDistribution$(value: any) {
    this.userDistribution.next(value);
  }

  get topQuests$(): Observable<GamificationTopPerformingQuestsDashboardType> {
    return this.topQuests.asObservable();
  }
  set topQuests$(value: any) {
    this.topQuests.next(value);
  }

  get usersStats$(): Observable<GamificationGetCorporateUsersStatsDashboardType> {
    return this.usersStats.asObservable();
  }
  set usersStats$(value: any) {
    this.usersStats.next(value);
  }

  get loadingUsersStats$(): Observable<boolean> {
    return this.loadingUsersStats.asObservable();
  }

  constructor(
    private posService: PosService,
    private searchPosGQL: SearchPosGQL,
    private userService: UserService,
    private storageHelper: StorageHelper,
    private inventoryService: InventoryService,
    private getMenuBadgesGQL: GetMenuBadgesGQL,
    private getActiveQuestsStatsGQL: GetActiveQuestsStatsGQL,
    private getMainDashboardStatsGQL: GetMainDashboardStatsGQL,
    private getCorporateUsersStatsGQL: GetCorporateUsersStatsGQL,
    private getTopPerformingQuestsGQL: GetTopPerformingQuestsGQL,
    private deleteCorporateDashboardGQL: DeleteCorporateDashboardGQL,
    private createCorporateDashboardGQL: CreateCorporateDashboardGQL,
    private updateCorporateDashboardGQL: UpdateCorporateDashboardGQL,
    private reorderCorporateDashboardGQL: ReorderCorporateDashboardGQL,
    private getAnalyticsUsersByDeviceGQL: GetAnalyticsUsersByDeviceGQL,
    private findBlogsByTargetPaginatedGQL: FindBlogsByTargetPaginatedGQL,
    private getSimpleProductWithFilterGQL: GetSimpleProductWithFilterGQL,
    private getUserDistributionsByLevelGQL: GetUserDistributionsByLevelGQL,
    private searchCorporateUsersByTargetGQL: SearchCorporateUsersByTargetGQL,
    private getProjectsByTargetWithFilterGQL: GetProjectsByTargetWithFilterGQL,
    private findNonPredefinedQuestsByTargetGQL: FindNonPredefinedQuestsByTargetGQL,
    private getCorporateDashboardByTargetAndUserGQL: GetCorporateDashboardByTargetAndUserGQL,
    private getBarcodesByTargetWithInternalProductPaginatedGQL: GetBarcodesByTargetWithInternalProductPaginatedGQL,
  ) {}

  searchPos(): Observable<PointOfSaleType[]> {
    return this.searchPosGQL
      .fetch({
        pagination: { page: this.posPageIndex, limit: this.pageLimit },
        searchString: this.posSearchString,
      })
      .pipe(
        map(({ data }: any) => {
          if (data) {
            this.pagination.next({
              page: this.posPageIndex,
              size: this.pageLimit,
              length: data.searchPos?.count,
            });
            this.isLastTargets.next(data.searchPos.isLast);
            this.targets.next([...(this.targets.value || []), ...data.searchPos.objects]);
            return data.searchPos.objects;
          }
        }),
      );
  }

  getCorporateUsersStats(): Observable<GamificationGetCorporateUsersStatsDashboardType> {
    this.loadingUsersStats.next(true);
    return this.getCorporateUsersStatsGQL.fetch({ target: { pos: this.storageHelper.getData('posId') } }).pipe(
      map(({ data }: any) => {
        this.loadingUsersStats.next(false);
        if (data) {
          this.usersStats.next(data.getCorporateUsersStats);
          return data.getCorporateUsersStats;
        }
      }),
    );
  }

  getTopPerformingQuests(count: number, fetchPolicy: FetchPolicy = 'cache-first'): Observable<GamificationTopPerformingQuestsDashboardType> {
    this.loadingTopQuests.next(true);
    return this.getTopPerformingQuestsGQL.fetch({ count, target: { pos: this.storageHelper.getData('posId') } }, { fetchPolicy }).pipe(
      map(({ data }: any) => {
        this.loadingTopQuests.next(false);
        if (data) {
          this.topQuests.next(data.getTopPerformingQuests);
          return data.getTopPerformingQuests;
        }
      }),
    );
  }

  getUserDistributionsByLevel(fetchPolicy: FetchPolicy = 'cache-first'): Observable<GamificationUserDistributionsByLevelDashboardType[]> {
    this.loadingUserDistribution.next(true);
    return this.getUserDistributionsByLevelGQL.fetch({ target: { pos: this.storageHelper.getData('posId') } }, { fetchPolicy }).pipe(
      map(({ data }: any) => {
        this.loadingUserDistribution.next(false);
        if (data) {
          this.userDistribution.next(data.getUserDistributionsByLevel);
          return data.getUserDistributionsByLevel;
        }
      }),
    );
  }

  getMenuBadges(): Observable<GetMenuBadgesType> {
    return this.userService.user$.pipe(
      take(1),
      switchMap((user) => {
        if (!user) {
          return of(null);
        }
        return this.getMenuBadgesGQL.fetch({ target: { pos: this.storageHelper.getData('posId') }, user: user.id }).pipe(
          map(({ data }) => {
            this.menuBadges.next(data.getMenuBadges);
            return data.getMenuBadges;
          }),
        );
      }),
    );
  }

  getSimpleProductWithFilter(pageLimit: number, sort: SortingField[] = [{ createdAt: -1 }]): Observable<InternalProductType[]> {
    return this.inventoryService.filter$.pipe(
      take(1),
      switchMap((filter) =>
        this.getSimpleProductWithFilterGQL.fetch({
          sort,
          searchString: this.searchString,
          filter: { ...filter, status: [ProductStatusEnum?.ACTIVE], target: { pos: [this.storageHelper.getData('posId')] } },
          pagination: { limit: pageLimit, page: this.pageIndex },
        }),
      ),
      map(({ data }: any) => {
        this.simpleProducts.next(data.getSimpleProductWithFilter.objects);
        this.pagination.next({
          page: this.pageIndex,
          size: pageLimit,
          length: data.getSimpleProductWithFilter?.count,
        });
        return data.getSimpleProductWithFilter.objects;
      }),
    );
  }

  searchCorporateUsersByTarget(pageLimit: number): Observable<CorporateUserType[]> {
    return this.posService.pos$.pipe(
      take(1),
      switchMap((pos) => {
        if (!pos) {
          return of([]);
        }
        return this.searchCorporateUsersByTargetGQL
          .fetch({
            input: {
              ...(this.searchString ? { searchString: this.searchString } : {}),
              pagination: { page: this.pageIndex, limit: pageLimit },
              target: { pos: pos.id },
            },
          })
          .pipe(
            map(({ data }: any) => {
              if (data) {
                this.corporateUsers.next(data.searchCorporateUsersByTarget.objects);
                this.pagination.next({
                  length: data.searchCorporateUsersByTarget.count,
                  size: pageLimit,
                  page: this.pageIndex,
                });
                return data.searchCorporateUsersByTarget.objects;
              }
            }),
          );
      }),
    );
  }

  findNonPredefinedQuestsByTarget(pageLimit: number): Observable<QuestType[]> {
    return this.posService.pos$.pipe(
      take(1),
      switchMap((pos) => {
        if (!pos) {
          return of([]);
        }
        return this.findNonPredefinedQuestsByTargetGQL
          .fetch({
            ...(this.searchString ? { searchString: this.searchString } : {}),
            pagination: { page: this.pageIndex, limit: pageLimit },
            target: { pos: pos.id },
          })
          .pipe(
            map(({ data }: any) => {
              if (data) {
                this.quests.next(data.findNonPredefinedQuestsByTarget.objects);
                this.pagination.next({
                  length: data.findNonPredefinedQuestsByTarget.count,
                  size: pageLimit,
                  page: this.pageIndex,
                });
                return data.findNonPredefinedQuestsByTarget.objects;
              }
            }),
          );
      }),
    );
  }

  getProjectsByTargetWithFilter(pageLimit: number): Observable<ProjectType[]> {
    return this.getProjectsByTargetWithFilterGQL
      .fetch({
        target: { pos: this.storageHelper.getData('posId') },
        pagination: { page: this.pageIndex, limit: pageLimit },
        searchString: this.searchString,
      })
      .pipe(
        map(({ data }: any) => {
          if (data) {
            this.projects.next(data.getProjectsByTargetWithFilter.objects);
            this.pagination.next({
              page: this.pageIndex,
              size: pageLimit,
              length: data.getProjectsByTargetWithFilter?.count,
            });
            return data.getProjectsByTargetWithFilter.objects;
          }
        }),
      );
  }

  findBlogsByTargetPaginated(pageLimit: number): Observable<BlogType[]> {
    return this.findBlogsByTargetPaginatedGQL
      .fetch({
        pagination: { page: this.pageIndex, limit: pageLimit },
        searchString: this.searchString,
        target: { pos: this.storageHelper.getData('posId') },
      })
      .pipe(
        map(({ data }: any) => {
          if (data) {
            this.blogs.next(data.findBlogsByTargetPaginated.objects);
            this.pagination.next({
              page: this.pageIndex,
              size: pageLimit,
              length: data.findBlogsByTargetPaginated?.count,
            });
            return data.findBlogsByTargetPaginated.objects;
          }
        }),
      );
  }

  getBarcodesByTargetPaginated(pageLimit: number): Observable<BarcodeType[]> {
    return this.getBarcodesByTargetWithInternalProductPaginatedGQL
      .fetch({
        target: { pos: this.storageHelper.getData('posId') },
        searchString: this.searchString,
        pagination: { page: this.pageIndex, limit: pageLimit },
      })
      .pipe(
        map(({ data }: any) => {
          this.barcodes.next(data.getBarcodesByTargetWithInternalProductPaginated.objects);
          this.pagination.next({
            page: this.pageIndex,
            size: pageLimit,
            length: data.getBarcodesByTargetWithInternalProductPaginated?.count,
          });
          return data.getBarcodesByTargetWithInternalProductPaginated.objects;
        }),
      );
  }

  getMainDashboardStats(fetchPolicy: FetchPolicy = 'cache-first'): Observable<MainDashboardStatsType> {
    this.loadingMainDashboard.next(true);
    return this.getMainDashboardStatsGQL.fetch({ target: { pos: this.storageHelper.getData('posId') } }, { fetchPolicy }).pipe(
      map(({ data }: any) => {
        this.loadingMainDashboard.next(false);
        this.mainDashboard.next(data.getMainDashboardStats);
        return data.getMainDashboardStats;
      }),
    );
  }

  getCorporateDashboardByTargetAndUser(fetchPolicy: FetchPolicy = 'cache-first'): Observable<CorporateUserDashType[]> {
    this.loadingCorporateDashboard.next(true);
    return this.getCorporateDashboardByTargetAndUserGQL.fetch({ target: { pos: this.storageHelper.getData('posId') } }, { fetchPolicy }).pipe(
      map(({ data }: any) => {
        this.loadingCorporateDashboard.next(false);
        this.dashboards.next(data.getCorporateDashboardByTargetAndUser);
        return data.getCorporateDashboardByTargetAndUser;
      }),
    );
  }

  getAnalyticsUsersByDevice(input: AnalyticsDashboardInput, fetchPolicy: FetchPolicy = 'cache-first'): Observable<AnalyticsUsersByDeviceType> {
    this.loadingUsersByDevice.next(true);
    return this.getAnalyticsUsersByDeviceGQL
      .fetch(
        {
          input: { from: input?.from, to: input?.to, target: { pos: this.storageHelper.getData('posId') } },
        },
        { fetchPolicy },
      )
      .pipe(
        map(({ data }: any) => {
          this.loadingUsersByDevice.next(false);
          this.usersByDevice.next(data.getAnalyticsUsersByDevice);
          return data.getAnalyticsUsersByDevice;
        }),
      );
  }

  getActiveQuestsStats(fetchPolicy: FetchPolicy = 'cache-first'): Observable<ActiveQuestsStatsType> {
    this.loadingActiveQuests.next(true);
    return this.getActiveQuestsStatsGQL
      .fetch(
        {
          target: { pos: this.storageHelper.getData('posId') },
        },
        { fetchPolicy },
      )
      .pipe(
        map(({ data }: any) => {
          this.loadingActiveQuests.next(false);
          this.activeQuests.next(data.getActiveQuestsStats);
          return data.getActiveQuestsStats;
        }),
      );
  }

  reorderCorporateDashboard(input: any): Observable<CorporateUserDashType[]> {
    return this.reorderCorporateDashboardGQL
      .mutate({ target: { pos: this.storageHelper.getData('posId') }, dashboardId: input.dashboardId, newRank: input.newRank })
      .pipe(
        map(({ data }: any) => {
          this.dashboards.next(data.reorderCorporateDashboard);
          return data.reorderCorporateDashboard;
        }),
      );
  }

  createCorporateDashboard(input: CorporateUserDashboardInput): Observable<CorporateUserDashType> {
    return this.createCorporateDashboardGQL.mutate({ input: { ...input, target: { pos: this.storageHelper.getData('posId') } } }).pipe(
      map(({ data }: any) => {
        this.dashboards.next([data.createCorporateDashboard, ...(this.dashboards.value?.length ? this.dashboards.value : [])]);
        return data.createCorporateDashboard;
      }),
    );
  }

  updateCorporateDashboard(input: CorporateUserDashboardUpdateInput): Observable<CorporateUserDashType> {
    return this.updateCorporateDashboardGQL.mutate({ input }).pipe(
      map(({ data }: any) => {
        if (data) {
          const dashboards = this.dashboards.value;
          const index = this.dashboards.value?.findIndex((a) => a.id === input.id);
          dashboards[index] = data.updateCorporateDashboard;
          this.dashboards.next(dashboards);
          return data.updateCorporateDashboard;
        }
        return null;
      }),
    );
  }

  deleteCorporateDashboard(id: string): Observable<boolean> {
    return this.deleteCorporateDashboardGQL.mutate({ id }).pipe(
      map(({ data }: any) => {
        if (data.deleteCorporateDashboard) {
          const dashboards = this.dashboards.value.filter((item) => item.id !== id);
          this.dashboards.next(dashboards);
          return true;
        }
        return false;
      }),
    );
  }
}
