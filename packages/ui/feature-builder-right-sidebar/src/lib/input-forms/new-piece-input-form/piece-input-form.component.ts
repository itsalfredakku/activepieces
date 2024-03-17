import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FlagService,
  PieceConnectionDropdownItem,
  PieceMetadataModel,
  UiCommonModule,
  appConnectionsSelectors,
} from '@activepieces/ui/common';
import { UiFeatureBuilderFormControlsModule } from '@activepieces/ui/feature-builder-form-controls';
import { Store } from '@ngrx/store';
import { PieceMetadataService } from '@activepieces/ui/feature-pieces';
import { BuilderSelectors, Step } from '@activepieces/ui/feature-builder-store';
import {
  Observable,
  combineLatest,
  map,
  of,
  shareReplay,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import {
  AUTHENTICATION_PROPERTY_NAME,
  ActionType,
  PopulatedFlow,
  TriggerType,
  spreadIfDefined,
} from '@activepieces/shared';
import { ActionBase, TriggerBase } from '@activepieces/pieces-framework';
import { FormControl, Validators } from '@angular/forms';

@Component({
  selector: 'app-new-piece-input-form',
  standalone: true,
  imports: [CommonModule, UiCommonModule, UiFeatureBuilderFormControlsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if(deps$ | async; as deps) {

    <app-action-or-trigger-dropdown
      [items]="deps.triggersOrActions"
      [passedFormControl]="triggersOrActionsControl"
    >
    </app-action-or-trigger-dropdown>
    @if(deps.currentStep && deps.selectedTriggerOrAction && deps.pieceMetaData)
    {
    <app-new-piece-properties-form
      [stepName]="deps.currentStep.name"
      [allConnectionsForPiece]="deps.allConnectionsForPiece"
      [pieceMetaData]="deps.pieceMetaData"
      [stepSettings]="deps.currentStep.settings"
      [flow]="deps.currentFlow"
      [webhookPrefix]="deps.webhookPrefix"
      [formPieceTriggerPrefix]="deps.formPieceTriggerPrefix"
      [propertiesMap]="deps.selectedTriggerOrAction.props"
    ></app-new-piece-properties-form>
    } } @else(){
    <div
      class="ap-flex ap-flex-grow ap-justify-center ap-items-center ap-h-[250px]"
    >
      <ap-loading-icon> </ap-loading-icon>
    </div>
    }
  `,
})
export class NewPieceInputFormComponent {
  triggersOrActionsControl: FormControl<string>;

  deps$: Observable<{
    currentStep: Step | undefined;
    triggersOrActions: (TriggerBase | ActionBase)[];
    selectedTriggerOrAction: TriggerBase | ActionBase | undefined;
    pieceMetaData: PieceMetadataModel | undefined;
    webhookPrefix: string;
    formPieceTriggerPrefix: string;
    currentFlow: PopulatedFlow;
    allConnectionsForPiece: PieceConnectionDropdownItem[];
  }>;

  constructor(
    private store: Store,
    private pieceMetaDataService: PieceMetadataService,
    private flagService: FlagService
  ) {
    this.triggersOrActionsControl = new FormControl<string>('', {
      nonNullable: true,
      validators: Validators.required,
    });
    this.deps$ = combineLatest({
      currentStep: this.store.select(BuilderSelectors.selectCurrentStep).pipe(
        tap((step) => {
          if (step) {
            if (step.type === ActionType.PIECE) {
              this.triggersOrActionsControl.setValue(
                step.settings.actionName || ''
              );
            } else if (step.type === TriggerType.PIECE) {
              this.triggersOrActionsControl.setValue(
                step.settings.triggerName || ''
              );
            }
          }
        })
      ),
      triggersOrActions: this.getTriggersOrActions(),
      selectedTriggerOrAction: this.getSelectedTriggerOrAction(),
      pieceMetaData: this.getPieceMetaData(),
      webhookPrefix: this.flagService.getWebhookUrlPrefix(),
      formPieceTriggerPrefix: this.flagService.getFormUrlPrefix(),
      currentFlow: this.store.select(BuilderSelectors.selectCurrentFlow),
      allConnectionsForPiece: this.getAllConnectionsForPiece(),
    });
  }
  getTriggersOrActions() {
    const currentStep$ = this.store.select(BuilderSelectors.selectCurrentStep);
    return currentStep$.pipe(
      switchMap((step) => {
        if (!step) return of([]);
        switch (step.type) {
          case ActionType.PIECE:
            return this.pieceMetaDataService.getPieceActions(
              step.settings.pieceName,
              step.settings.pieceVersion
            );
          case TriggerType.PIECE:
            return this.pieceMetaDataService.getPieceTriggers(
              step.settings.pieceName,
              step.settings.pieceVersion
            );
          default: {
            console.error("step type isn't piece");
            return of([]);
          }
        }
      }),
      shareReplay(1)
    );
  }
  getSelectedTriggerOrAction() {
    const deps$ = {
      selectedTriggerOrActionName:
        this.triggersOrActionsControl.valueChanges.pipe(
          startWith(this.triggersOrActionsControl.value)
        ),
      triggersOrActions: this.getTriggersOrActions(),
      pieceMetaData: this.getPieceMetaData(),
    };
    return combineLatest(deps$).pipe(
      map((res) => {
        const triggerOrAction = res.triggersOrActions.find(
          (v) => v.name === res.selectedTriggerOrActionName
        );
        if (triggerOrAction) {
          return addPieceAuthenticationPropertyToTriggerOrActionProperties(
            triggerOrAction,
            res
          );
        }
        return undefined;
      })
    );

    function addPieceAuthenticationPropertyToTriggerOrActionProperties(
      triggerOrAction: ActionBase | TriggerBase,
      res: {
        selectedTriggerOrActionName: string;
        triggersOrActions: ActionBase[] | TriggerBase[];
        pieceMetaData: PieceMetadataModel | undefined;
      }
    ) {
      const selected = {
        ...triggerOrAction,
        props: {
          ...spreadIfDefined(
            AUTHENTICATION_PROPERTY_NAME,
            res.pieceMetaData?.auth
          ),
          ...triggerOrAction.props,
        },
      };
      return selected;
    }
  }
  getPieceMetaData(): Observable<PieceMetadataModel | undefined> {
    const currentStep$ = this.store.select(BuilderSelectors.selectCurrentStep);
    return currentStep$.pipe(
      switchMap((step) => {
        if (!step) {
          console.error('step is undefined');
          return of(undefined);
        }
        if (step.type === ActionType.PIECE || step.type === TriggerType.PIECE) {
          return this.pieceMetaDataService.getPieceMetadata(
            step.settings.pieceName,
            step.settings.pieceVersion
          );
        }
        console.error('step type is not piece');
        return of(undefined);
      })
    );
  }

  getAllConnectionsForPiece() {
    const currentStep$ = this.store.select(BuilderSelectors.selectCurrentStep);
    return currentStep$.pipe(
      switchMap((step) => {
        if (
          !step ||
          (step.type !== ActionType.PIECE && step.type !== TriggerType.PIECE)
        )
          return of([]);
        return this.store.select(
          appConnectionsSelectors.selectAllConnectionsForPiece(
            step.settings.pieceName
          )
        );
      })
    );
  }
}
