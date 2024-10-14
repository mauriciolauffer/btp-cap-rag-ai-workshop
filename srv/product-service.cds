using {API_PRODUCT_SRV as productExt} from './external/API_PRODUCT_SRV';

service ProductService {
  entity A_Product as projection on productExt.A_Product {
    key Product,
    ProductType,
    CreationDate,
    CreatedByUser,
    LastChangeDate,
    LastChangedByUser,
    LastChangeDateTime,
    IsMarkedForDeletion,
    ProductOldID,
    GrossWeight,
    PurchaseOrderQuantityUnit,
    SourceOfSupply,
    WeightUnit,
    NetWeight,
    CountryOfOrigin,
    CompetitorID,
    ProductGroup,
    BaseUnit,
    ItemCategoryGroup,
    ProductHierarchy,
    Division,
    VarblPurOrdUnitIsActive,
    VolumeUnit,
    MaterialVolume,
    ANPCode,
    Brand,
    IndustrySector,
    to_Description,
    to_ProductBasicText,
    to_ProductPurchaseText,
    to_SalesDelivery
  };
  entity A_ProductBasicText as projection on productExt.A_ProductBasicText;
  entity A_ProductDescription as projection on productExt.A_ProductDescription;
  entity A_ProductPurchaseText as projection on productExt.A_ProductPurchaseText;
  entity A_ProductSalesText as projection on productExt.A_ProductSalesText;
  entity A_ProductSalesDelivery as projection on productExt.A_ProductSalesDelivery;
}

annotate ProductService with @(requires: 'authenticated-user');
