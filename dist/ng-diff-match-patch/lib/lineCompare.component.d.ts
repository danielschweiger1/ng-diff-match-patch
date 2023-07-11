import { OnInit, OnChanges } from '@angular/core';
import { DiffMatchPatchService } from './diffMatchPatch.service';
import * as i0 from "@angular/core";
export declare class LineCompareComponent implements OnInit, OnChanges {
    private dmp;
    left: string | number | boolean;
    right: string | number | boolean;
    lineContextSize: number;
    calculatedDiff: Array<[string, string, string, string]>;
    isContentEqual: boolean;
    constructor(dmp: DiffMatchPatchService);
    ngOnInit(): void;
    ngOnChanges(): void;
    private updateHtml;
    private calculateLineDiff;
    private outputEqualDiff;
    private outputEqualDiffLines;
    private outputDeleteDiff;
    private outputInsertDiff;
    static ɵfac: i0.ɵɵFactoryDeclaration<LineCompareComponent, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<LineCompareComponent, "dmp-line-compare", never, { "left": { "alias": "left"; "required": false; }; "right": { "alias": "right"; "required": false; }; "lineContextSize": { "alias": "lineContextSize"; "required": false; }; }, {}, never, never, false, never>;
}
