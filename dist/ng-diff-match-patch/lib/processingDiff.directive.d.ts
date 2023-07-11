import { ElementRef, OnInit, OnChanges } from '@angular/core';
import { DiffMatchPatchService } from './diffMatchPatch.service';
import * as i0 from "@angular/core";
export declare class ProcessingDiffDirective implements OnInit, OnChanges {
    private el;
    private dmp;
    left: string;
    right: string;
    constructor(el: ElementRef, dmp: DiffMatchPatchService);
    ngOnInit(): void;
    ngOnChanges(): void;
    private updateHtml;
    private createHtml;
    static ɵfac: i0.ɵɵFactoryDeclaration<ProcessingDiffDirective, never>;
    static ɵdir: i0.ɵɵDirectiveDeclaration<ProcessingDiffDirective, "[processingDiff]", never, { "left": { "alias": "left"; "required": false; }; "right": { "alias": "right"; "required": false; }; }, {}, never, never, false, never>;
}
