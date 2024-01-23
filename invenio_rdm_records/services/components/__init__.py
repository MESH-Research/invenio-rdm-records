# -*- coding: utf-8 -*-
#
# Copyright (C) 2021 CERN.
#
# Invenio-RDM-Records is free software; you can redistribute it and/or modify
# it under the terms of the MIT License; see LICENSE file for more details.


"""High-level API for working with RDM service components."""

from invenio_drafts_resources.services.records.components import (
    DraftFilesComponent,
    PIDComponent,
    RelationsComponent,
)
from .access import AccessComponent
from .custom_fields import CustomFieldsComponent
from .metadata import MetadataComponent
from .parent import ParentRecordAccessComponent
from .pids import PIDsComponent
from .review import ReviewComponent

DefaultRecordsComponents = [
    MetadataComponent,
    CustomFieldsComponent,
    AccessComponent,
    DraftFilesComponent,
    # for the internal `pid` field
    PIDComponent,
    # for the `pids` field (external PIDs)
    PIDsComponent,
    RelationsComponent,
    ReviewComponent,
]


__all__ = (
    "DefaultRecordsComponents",
    "AccessComponent",
    "CustomFieldsComponent",
    "MetadataComponent",
    "ParentRecordAccessComponent",
    "PIDsComponent",
    "ReviewComponent",
)
