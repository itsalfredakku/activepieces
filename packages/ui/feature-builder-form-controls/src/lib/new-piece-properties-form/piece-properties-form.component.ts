import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import {
  DropdownOption,
  PieceProperty,
  PiecePropertyMap,
  PropertyType,
} from '@activepieces/pieces-framework';
import { PieceMetadataModel, jsonValidator } from '@activepieces/ui/common';
import {
  PieceActionSettings,
  PieceTriggerSettings,
  PopulatedFlow,
} from '@activepieces/shared';
import {
  FormBuilder,
  FormControl,
  UntypedFormGroup,
  Validators,
} from '@angular/forms';
import { Observable, tap } from 'rxjs';
import { ValidatorFn } from '@angular/forms';

@Component({
  selector: 'app-new-piece-properties-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './piece-properties-form.component.html',
})
export class NewPiecePropertiesFormComponent implements OnInit {
  @Input({ required: true }) pieceMetaData: PieceMetadataModel;
  @Input({ required: true }) stepName: string;
  @Input({ required: true }) flow: Pick<PopulatedFlow, 'id' | 'version'>;
  @Input({ required: true }) webhookPrefix: string;
  @Input({ required: true }) formPieceTriggerPrefix: string;
  @Input({ required: true }) propertiesMap: PiecePropertyMap;
  @Input({ required: true }) stepSettings:
    | PieceActionSettings
    | PieceTriggerSettings;
  @Input({ required: true })
  allConnectionsForPiece: DropdownOption<`{{connections['${string}']}}`>[];
  @Output() formValueChange = new EventEmitter<
    PieceActionSettings | PieceTriggerSettings
  >();
  readonly PropertyType = PropertyType;
  //TODO: Ask why this is unknown in shared and not boolean
  customizedInputs: Record<string, unknown> = {};
  sortedPropertiesByRequired: PiecePropertyMap;
  form: UntypedFormGroup = this.fb.group({});
  listener$?: Observable<unknown>;
  constructor(private fb: FormBuilder) {}
  ngOnInit(): void {
    this.initializeForm();
  }

  private initializeForm() {
    this.sortPropertiesByRequired();
    this.form = this.buildForm();
    this.customizedInputs =
      this.stepSettings.inputUiInfo.customizedInputs || {};
    this.listener$ = this.createListener();
  }

  private sortPropertiesByRequired() {
    const requiredProperties: PiecePropertyMap = {};
    const optionalProperties: PiecePropertyMap = {};
    Object.entries(this.propertiesMap).forEach(([key, value]) => {
      if (value.required) {
        requiredProperties[key] = value;
      } else {
        optionalProperties[key] = value;
      }
    });
    this.sortedPropertiesByRequired = {
      ...requiredProperties,
      ...optionalProperties,
    };
  }

  private buildForm() {
    const form = this.fb.group({});
    Object.entries(this.propertiesMap).forEach(([propertyName, property]) => {
      const value = this.stepSettings.input[propertyName];
      const validators: ValidatorFn[] = [];
      if (this.propertiesMap[propertyName].required) {
        validators.push(Validators.required);
      }
      if (
        property.type === PropertyType.JSON &&
        (!this.stepSettings.inputUiInfo.customizedInputs ||
          !this.stepSettings.inputUiInfo.customizedInputs[propertyName])
      ) {
        validators.push(jsonValidator);
      }

      const ctrl = new FormControl(value, {
        validators: validators,
      });
      form.addControl(propertyName, ctrl);
    });
    return form;
  }

  toggleCustomizedInput(
    property: PieceProperty,
    propertyName: string,
    value: boolean
  ) {
    this.customizedInputs[propertyName] = value;
    if (property.type === PropertyType.JSON) {
      if (value) {
        this.form.controls[propertyName].removeValidators(jsonValidator);
      } else {
        this.form.controls[propertyName].addValidators(jsonValidator);
      }
    }
    this.form.controls[propertyName].setValue('', { emitEvent: false });
    this.form.controls[propertyName].updateValueAndValidity({
      emitEvent: false,
    });
  }
  private createListener() {
    return this.form.valueChanges.pipe(
      tap((res) => {
        this.formValueChange.emit({
          ...this.stepSettings,
          input: res,
          inputUiInfo: {
            ...this.stepSettings.inputUiInfo,
            customizedInputs: this.customizedInputs,
          },
        });
      })
    );
  }
}
