package model

import (
 "context"
 "errors"
 "os"
 "testing"

 "github.com/QuantumNous/new-api/common"
 "github.com/QuantumNous/new-api/constant"
 "github.com/glebarez/sqlite"
 "github.com/stretchr/testify/assert"
 "github.com/stretchr/testify/require"
 "gorm.io/driver/mysql"
 "gorm.io/driver/postgres"
 "gorm.io/gorm"
)

func TestClientCredentialRotationPersistenceAndRollback(t *testing.T) {
 for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
  t.Run(dialect, func(t *testing.T) {
   var driver gorm.Dialector
   databaseType := common.DatabaseTypeSQLite
   versionQuery := "SELECT sqlite_version()"
   switch dialect {
   case "sqlite": driver = sqlite.Open(t.TempDir() + "/client-auth.db")
   case "mysql":
    dsn := os.Getenv("CLIENT_OAUTH_TEST_MYSQL_DSN")
    if dsn == "" { t.Skip("CLIENT_OAUTH_TEST_MYSQL_DSN must point to a disposable MySQL database") }
    driver = mysql.Open(dsn); databaseType = common.DatabaseTypeMySQL; versionQuery = "SELECT VERSION()"
   case "postgres":
    dsn := os.Getenv("CLIENT_OAUTH_TEST_POSTGRES_DSN")
    if dsn == "" { t.Skip("CLIENT_OAUTH_TEST_POSTGRES_DSN must point to a disposable PostgreSQL database") }
    driver = postgres.Open(dsn); databaseType = common.DatabaseTypePostgreSQL; versionQuery = "SELECT version()"
   }
   db, err := gorm.Open(driver, &gorm.Config{})
   require.NoError(t, err)
   sqlDB, err := db.DB(); require.NoError(t, err)
   sqlDB.SetMaxOpenConns(1)
   previous, previousType := DB, common.MainDatabaseType()
   DB = db; common.SetMainDatabaseType(databaseType); initCol()
   t.Cleanup(func() { DB = previous; common.SetMainDatabaseType(previousType); initCol(); require.NoError(t, sqlDB.Close()) })
   var version string
   require.NoError(t, db.Raw(versionQuery).Scan(&version).Error)
   t.Logf("database: %s", version)
   require.NoError(t, db.AutoMigrate(&Channel{}))
   priority, weight := int64(0), uint(1)
   row := Channel{Type: constant.ChannelTypeClientOAuth, Status: common.ChannelStatusEnabled, Name: "credential-rotation-test", Key: `{"access_token":"old","refresh_token":"refresh-old"}`, Priority: &priority, Weight: &weight}
   require.NoError(t, db.Create(&row).Error)
   t.Cleanup(func() { require.NoError(t, db.Delete(&Channel{}, row.Id).Error) })
   for i := 0; i < 2; i++ {
    require.NoError(t, UpdateClientCredential(context.Background(), row.Id, func(raw string) (string, error) {
     if i == 0 { assert.Equal(t, row.Key, raw) } else { assert.Equal(t, `{"access_token":"new","refresh_token":"rotated"}`, raw) }
     return `{"access_token":"new","refresh_token":"rotated"}`, nil
    }))
   }
   require.Error(t, UpdateClientCredential(context.Background(), row.Id, func(raw string) (string, error) { return "", errors.New("provider unavailable") }))
   var stored Channel
   require.NoError(t, db.First(&stored, row.Id).Error)
   assert.Equal(t, `{"access_token":"new","refresh_token":"rotated"}`, stored.Key)
   require.NoError(t, db.Model(&Channel{}).Where("id = ?", row.Id).Update("status", common.ChannelStatusManuallyDisabled).Error)
   called := false
   require.Error(t, UpdateClientCredential(context.Background(), row.Id, func(raw string) (string, error) { called = true; return raw, nil }))
   assert.False(t, called)
  })
 }
}
